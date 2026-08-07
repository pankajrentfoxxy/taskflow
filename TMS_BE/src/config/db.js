import { Sequelize } from "sequelize";

// Discrete env vars instead of a single DATABASE_URL — avoids the
// URL-encoding dance when the DB password contains URL-reserved characters
// (`@`, `#`, `+`, `[`, etc.) on shared-hosting setups like cPanel.
const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, NODE_ENV } =
  process.env;

if (!DB_NAME || !DB_USER || DB_PASSWORD === undefined) {
  throw new Error(
    "Database config missing — set DB_NAME, DB_USER, and DB_PASSWORD env vars.",
  );
}

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: Number(DB_PORT) || 5432,
  dialect: "postgres",
  logging: NODE_ENV === "development" ? console.log : false,
  define: {
    underscored: true,
    timestamps: true,
  },
});

export default sequelize;
