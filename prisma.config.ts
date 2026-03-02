import { defineConfig } from '@prisma/config';
import 'dotenv/config'; // Make sure to load the .env file

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
