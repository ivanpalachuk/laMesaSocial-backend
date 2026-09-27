// Run with Node 24+: node --test tests/coupon-deletion.test.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// Resolve the Worker's extensionless TypeScript imports without a build step.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".")) {
      const url = new URL(specifier, context.parentURL);
      for (const suffix of [".ts", "/index.ts"]) {
        if (existsSync(fileURLToPath(url) + suffix)) return nextResolve(url.href + suffix, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      return { format: "module", source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8")), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { default: couponsRoutes } = await import("../src/routes/coupons.ts");
const { default: pedidosRoutes } = await import("../src/routes/pedidos.ts");
const { generateAccessToken } = await import("../src/utils/jwt.ts");

async function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrations = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  }
  sqlite.exec(`
    INSERT INTO users (id,email,password,name,role,created_at,updated_at)
      VALUES ('admin','admin@example.com','unused','Admin','admin',1,1);
    INSERT INTO productos (id,title,price,stock,created_by,created_at,updated_at)
      VALUES ('product','Juego',1000,10,'admin',1,1);
    INSERT INTO coupons (id,code,discount_type,discount_value,created_by,created_at,updated_at)
      VALUES ('coupon','SAVE10','percentage',10,'admin',1,1);
  `);
  // A small D1 adapter runs the production Drizzle queries against real SQLite.
  const db = {
    beforeQuery: undefined,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async raw() {
              await db.beforeQuery?.(sql);
              const statement = sqlite.prepare(sql);
              statement.setReturnArrays(true);
              return statement.all(...params);
            },
            async all() {
              await db.beforeQuery?.(sql);
              return { results: sqlite.prepare(sql).all(...params) };
            },
            async run() {
              await db.beforeQuery?.(sql);
              return { success: true, meta: sqlite.prepare(sql).run(...params) };
            },
          };
        },
      };
    },
  };
  const secret = "coupon-deletion-test-secret";
  const tokens = {};
  for (const role of ["admin", "user", "article_editor"]) {
    tokens[role] = await generateAccessToken("admin", "admin@example.com", role, secret);
  }
  const env = { DB: db, JWT_SECRET: secret };
  const request = (path, method = "GET", body, role = "admin", routes = couponsRoutes) => routes.request(path, {
    method,
    headers: {
      ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}),
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, env);
  return { sqlite, db, request };
}

test("deletion requires an authenticated admin and returns 404 for unknown coupons", async (t) => {
  const { sqlite, request } = await fixture(t);
  assert.equal((await request("/admin/coupon", "DELETE", undefined, null)).status, 401);
  for (const role of ["user", "article_editor"]) {
    assert.equal((await request("/admin/coupon", "DELETE", undefined, role)).status, 403);
  }
  assert.equal((await request("/admin/missing", "DELETE")).status, 404);
  assert.equal(sqlite.prepare("SELECT is_active FROM coupons").get().is_active, 1);
});

test("deletion hides and invalidates a redeemed coupon while preserving order history", async (t) => {
  const { sqlite, request } = await fixture(t);
  sqlite.exec(`
    INSERT INTO pedidos (id,user_id,status,subtotal,total,customer_name,customer_email,coupon_code,discount_amount,created_at,updated_at)
      VALUES ('order','admin','confirmed',1000,900,'Admin','admin@example.com','SAVE10',100,1,1);
    INSERT INTO coupon_redemptions (id,coupon_id,pedido_id,user_id,discount_amount,created_at)
      VALUES ('redemption','coupon','order','admin',100,1);
    UPDATE coupons SET used_count = 1;
  `);
  const ordersBefore = sqlite.prepare("SELECT * FROM pedidos").all();
  const redemptionsBefore = sqlite.prepare("SELECT * FROM coupon_redemptions").all();
  assert.equal((await (await request("/admin")).json()).coupons.length, 1);
  const response = await request("/admin/coupon", "DELETE");
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.deepEqual((await (await request("/admin")).json()).coupons, []);
  const deleted = sqlite.prepare("SELECT * FROM coupons").get();
  assert.equal(deleted.is_active, 0);
  assert.ok(deleted.deleted_at > 0);
  assert.equal(deleted.used_count, 1);
  assert.deepEqual(sqlite.prepare("SELECT * FROM pedidos").all(), ordersBefore);
  assert.deepEqual(sqlite.prepare("SELECT * FROM coupon_redemptions").all(), redemptionsBefore);
  assert.equal((await request("/admin/coupon", "DELETE")).status, 404);
  assert.equal((await request("/admin/coupon", "PATCH", { isActive: true })).status, 404);
  const cart = { code: "SAVE10", items: [{ productoId: "product", quantity: 1 }] };
  const validation = await request("/validate", "POST", cart);
  assert.equal(validation.status, 400);
  assert.equal((await validation.json()).error, "Cupón inválido");
  const checkout = await request("/", "POST", { ...cart, couponCode: "SAVE10" }, "admin", pedidosRoutes);
  assert.equal(checkout.status, 400);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM pedidos").get().count, 1);
  const recreate = await request("/admin", "POST", {
    code: "SAVE10", discountType: "percentage", discountValue: 10,
    minimumSubtotal: null, maximumDiscount: null, usageLimit: null,
  });
  assert.equal(recreate.status, 409);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
});

test("an activation racing with deletion cannot reactivate the deleted coupon", async (t) => {
  const { sqlite, db, request } = await fixture(t);
  db.beforeQuery = async (sql) => {
    if (!sql.startsWith('update "coupons"')) return;
    db.beforeQuery = undefined;
    assert.equal((await request("/admin/coupon", "DELETE")).status, 204);
  };
  assert.equal((await request("/admin/coupon", "PATCH", { isActive: true })).status, 404);
  assert.equal(sqlite.prepare("SELECT is_active FROM coupons").get().is_active, 0);
});

for (const usageLimit of [null, 2]) {
  test(`checkout rejects a coupon deleted after validation (usage limit: ${usageLimit})`, async (t) => {
    const { sqlite, db, request } = await fixture(t);
    sqlite.prepare("UPDATE coupons SET usage_limit = ?").run(usageLimit);
    db.beforeQuery = async (sql) => {
      if (!sql.startsWith('update "coupons"')) return;
      db.beforeQuery = undefined;
      assert.equal((await request("/admin/coupon", "DELETE")).status, 204);
    };
    const response = await request("/", "POST", {
      couponCode: "SAVE10", items: [{ productoId: "product", quantity: 1 }],
    }, "admin", pedidosRoutes);
    assert.equal(response.status, 409);
    assert.equal(sqlite.prepare("SELECT used_count FROM coupons").get().used_count, 0);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM pedidos").get().count, 0);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM coupon_redemptions").get().count, 0);
    assert.equal(sqlite.prepare("SELECT stock FROM productos").get().stock, 10);
  });
}
