import { hash } from "bcryptjs";

/**
 * One-off operator utility: `pnpm --filter @jobhunter/api hash-password <plaintext>`.
 * The result goes into OPERATOR_PASSWORD_HASH in .env -- there is no signup
 * route, so this is the only way that value ever gets set.
 */
async function main() {
  const [, , plaintext] = process.argv;
  if (!plaintext) {
    console.error("Usage: pnpm --filter @jobhunter/api hash-password <plaintext>");
    process.exit(1);
  }

  const rounds = Number(process.env.BCRYPT_ROUNDS ?? "12");
  const hashed = await hash(plaintext, rounds);
  console.log(hashed);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
