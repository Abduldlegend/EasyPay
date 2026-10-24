// Creates an admin account, or promotes an existing account to admin.
//
//   ADMIN_NAME="Ada Admin" ADMIN_EMAIL=ada@example.com ADMIN_PASSWORD='Str0ngPassw0rd' npm run create-admin
//
// Registration through the API can never grant the admin role, so this is the only way in.
import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { ensureAdminUser } from '../src/services/admin.service.js';
import { registerSchema } from '../src/validators/auth.validator.js';

const MESSAGES = {
    created: 'Admin account created.',
    promoted: 'Existing account promoted to admin.',
    unchanged: 'That account is already an active admin. Nothing changed.',
};

async function main() {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

    // Same rules as normal registration, so admin passwords are never weaker.
    const parsed = registerSchema.shape.body.safeParse({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
    });
    if (!parsed.success) {
        console.error('Invalid input. Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD:');
        parsed.error.issues.forEach((issue) => console.error(`  - ${issue.path.join('.')}: ${issue.message}`));
        process.exitCode = 1;
        return;
    }

    await connectDatabase();
    const { user, outcome } = await ensureAdminUser(parsed.data);
    console.log(`${MESSAGES[outcome]} (${user.email})`);
}

main()
    .catch((error) => {
        console.error('Could not create the admin:', error.message);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());