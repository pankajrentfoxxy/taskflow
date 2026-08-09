export const getConfig = async (req, res) => {
  res.json({
    DB_HOST: process.env.DB_HOST ?? null,
    DB_USER: process.env.DB_USER ?? null,
    DB_PASSWORD: process.env.DB_PASSWORD ?? null,
    DB_NAME: process.env.DB_NAME ?? null,
    DB_PORT: process.env.DB_PORT ?? null,
  });
};
