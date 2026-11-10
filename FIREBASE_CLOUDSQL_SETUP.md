# Firebase Authentication and Cloud SQL setup

This repository now includes the PostgreSQL schema and migration command, but the live Firebase project and Cloud SQL instance must be created in your Google account before the production server can use them.

## Firebase

1. Open Firebase Console and create or select a project.
2. Open **Authentication → Sign-in method**.
3. Enable **Email/Password** and **Google**.
4. Open **Project settings → General → Your apps**.
5. Add a Web app and record its public configuration for the browser.
6. Open **Project settings → Service accounts** and generate a private key.
7. Store the service-account fields only in Secret Manager:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.

The browser configuration is not a secret, but the service-account private key is. Do not put the private key in `index.html`, `script.js`, Git, or a ZIP shared publicly.

## Cloud SQL PostgreSQL

1. In Google Cloud Console, enable **Cloud SQL Admin API**.
2. Create a **PostgreSQL** Cloud SQL instance.
3. Create a database and a dedicated application user with a strong password.
4. Store the resulting `DATABASE_URL` in Secret Manager.
5. Grant the Cloud Run service account **Cloud SQL Client**.
6. Run `npm install` and then `npm run migrate` from a secured environment with `DATABASE_URL`.

## Implementation state

The production entry point is `server-postgres.js`. It verifies Firebase ID tokens, scopes customer order lookup by Firebase UID, protects admin routes with `ADMIN_UIDS` or an `admin` custom claim, and uses the PostgreSQL schema in `db/schema.sql`. The original `server.js` remains untouched as a legacy SQLite fallback and is not used by `npm start`.

The existing local SQLite database, if one exists, is not automatically copied into Cloud SQL. Export and review any real records before importing them into PostgreSQL; do not overwrite production data during migration.
