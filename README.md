# MB BD deployment

The storefront design, prices, logos, payment methods, and checkout features are preserved. Production uses `server-postgres.js`, Firebase Authentication, Cloud SQL PostgreSQL, manual payment verification, and Resend.

## Local setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Configure every variable, including Firebase web values and `ADMIN_UIDS`.
5. Run `npm run migrate`.
6. Run `npm test`.
7. Run `npm start`.

Open `http://localhost:3000`, `/auth.html`, and `/admin.html`.

## Required production services

- Firebase Authentication with Google and Email/Password enabled.
- Cloud SQL PostgreSQL with `DATABASE_URL`.
- Resend verified sending domain and `RESEND_API_KEY`.
- Secret Manager values for all private environment variables.
- Cloud Run service account with Cloud SQL Client and Secret Manager Secret Accessor roles.

The admin API accepts Firebase ID tokens and only permits users listed in `ADMIN_UIDS` or carrying the Firebase `admin` claim. A submitted transaction ID never marks a payment successful; only the protected admin verification route does.

## Migration and deployment

Run `npm run migrate` once against the configured Cloud SQL database, then deploy:

```powershell
gcloud run deploy mb-bd-top-of-all-apps --source . --region asia-south1 --allow-unauthenticated --port 8080
```

Attach Secret Manager references in the Cloud Run revision. Set `PUBLIC_ORIGIN` to the final HTTPS URL. Do not commit `.env`, private keys, database files, documents, or `node_modules`.
