# Firebase Secrets Configuration Guide

## Overview
Your Firebase App Hosting app uses Firebase secrets to securely store sensitive configuration values. This guide explains how secrets work and how to manage them.

## How Firebase Secrets Work

### 1. In `apphosting.yaml`
Secrets are referenced using the `${secret:SECRET_NAME}` syntax:
```yaml
runConfig:
  env:
    TWITCH_CLIENT_ID: ${secret:TWITCH_CLIENT_ID}
    TWITCH_CLIENT_SECRET: ${secret:TWITCH_CLIENT_SECRET}
    NEXT_PUBLIC_FIREBASE_API_KEY: ${secret:NEXT_PUBLIC_FIREBASE_API_KEY}
```

### 2. At Runtime
Firebase App Hosting automatically:
- Retrieves the secret values from Secret Manager
- Injects them as environment variables
- Makes them available to your Next.js app via `process.env`

### 3. In Next.js
- **Server-side**: All environment variables are accessible via `process.env`
- **Client-side**: Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- The `next.config.ts` env section explicitly exposes NEXT_PUBLIC_ variables

## Managing Secrets

### Check if Secrets Exist
```powershell
firebase apphosting:secrets:list
```

### Create/Update a Secret
```powershell
# Set from terminal input
firebase apphosting:secrets:set SECRET_NAME

# Set from file
firebase apphosting:secrets:set SECRET_NAME --data-file .env
```

### View Secret Metadata (not the value)
```powershell
firebase apphosting:secrets:describe SECRET_NAME
```

### Grant Access to Secrets
```powershell
firebase apphosting:secrets:access SECRET_NAME --grant
```

### Bulk Upload from .env file
Use the upload scripts in your project:
```powershell
node upload-secrets.js
# or
node upload-secrets-advanced.js
```

## Verification Steps

### 1. Verify Secrets are Uploaded
```powershell
firebase apphosting:secrets:list
```
You should see all secrets listed in `apphosting.yaml`.

### 2. Verify Build Access
Check that your App Hosting backend has permission to access secrets:
```powershell
firebase apphosting:backends:list
```

### 3. Test in Deployed App
After deployment, test that environment variables are accessible:
- Server-side: Check server logs or API routes
- Client-side: Check browser console for NEXT_PUBLIC_ variables

## Common Issues

### Issue: "Secret not found" Error
**Solution**: Upload the secret
```powershell
firebase apphosting:secrets:set SECRET_NAME
```

### Issue: NEXT_PUBLIC_ Variables Not Available in Browser
**Solution**: 
1. Ensure they're in `apphosting.yaml`
2. Ensure they're in the `env` section of `next.config.ts`
3. Rebuild and redeploy

### Issue: Secrets Not Updating
**Solution**: 
1. Update the secret value
2. Create a new rollout/deployment
```powershell
firebase apphosting:secrets:set SECRET_NAME
firebase deploy --only apphosting
```

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use Secret Manager** for production secrets
3. **Use .env files** only for local development
4. **Rotate secrets** regularly
5. **Grant minimal permissions** - only give access to secrets that are needed

## Current Configuration

### Secrets Defined in `apphosting.yaml`
Your app currently uses these secret categories:
- Firebase configuration (API keys, project IDs)
- Twitch API credentials
- Discord bot tokens and channel IDs
- Points system configuration
- Community features settings
- Bot authentication tokens

### Local Development
For local development, use the `.env` file. It will automatically be loaded by Next.js.

### Production Deployment
For production on Firebase App Hosting:
1. Secrets are stored in Google Cloud Secret Manager
2. Referenced in `apphosting.yaml`
3. Automatically injected at runtime
4. No .env file needed in production

## Troubleshooting Commands

### Check Current Environment
```powershell
# In your deployed app, create an API route to check:
# /api/check-env
export const GET = () => {
  return Response.json({
    hasFirebaseKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    hasTwitchId: !!process.env.TWITCH_CLIENT_ID,
    // etc - never return actual values!
  });
};
```

### View Build Logs
```powershell
firebase apphosting:rollouts:list --limit 1
```

## Next Steps

1. ✅ Secrets are defined in `apphosting.yaml`
2. ✅ Next.js config updated to expose NEXT_PUBLIC_ variables
3. ⏳ Upload secrets using `node upload-secrets.js`
4. ⏳ Deploy your app with `firebase deploy --only apphosting`
5. ⏳ Verify secrets are accessible in your deployed app

