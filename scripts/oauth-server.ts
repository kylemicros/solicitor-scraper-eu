import express from "express";
import open from "open";

import { env } from "../src/config/env.js";
import { log } from "../src/util/logger.js";

const app = express();
const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const TENANT_ID = env.AZURE_TENANT_ID || "consumers";
const CLIENT_ID = env.AZURE_CLIENT_ID;
const CLIENT_SECRET = env.AZURE_CLIENT_SECRET;
const SCOPES = "Files.ReadWrite offline_access";

const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_mode=query&scope=${encodeURIComponent(SCOPES)}&prompt=consent`;

app.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Azure OAuth Setup</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            line-height: 1.6;
          }
          .container {
            background: #f5f5f5;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #0078d4; }
          .button {
            display: inline-block;
            background: #0078d4;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin: 20px 0;
          }
          .button:hover { background: #005a9e; }
          code {
            background: #e1e1e1;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Monaco', 'Courier New', monospace;
          }
          .info {
            background: white;
            padding: 15px;
            border-left: 4px solid #0078d4;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Azure OAuth Setup</h1>
          <p>Click the button below to authorize this application to access your OneDrive:</p>
          <a href="${authUrl}" class="button">Authorize with Microsoft</a>
          
          <div class="info">
            <strong>Current Configuration:</strong><br>
            <code>Client ID: ${CLIENT_ID}</code><br>
            <code>Tenant: ${TENANT_ID}</code><br>
            <code>Redirect URI: ${REDIRECT_URI}</code><br>
            <code>Scopes: ${SCOPES}</code>
          </div>
          
          <p><strong>Note:</strong> Make sure your Azure App Registration has this redirect URI configured.</p>
        </div>
      </body>
    </html>
  `);
});

app.get("/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    log.error({ error, error_description }, "OAuth authorization failed");
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authorization Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
            }
            .error {
              background: #ffebee;
              border-left: 4px solid #f44336;
              padding: 20px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Authorization Failed</h1>
            <p><strong>Error:</strong> ${error}</p>
            <p><strong>Description:</strong> ${error_description}</p>
          </div>
        </body>
      </html>
    `);
    return;
  }

  try {
    log.info("Exchanging authorization code for tokens...");

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code as string,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        scope: SCOPES,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    log.info({ expires_in: tokens.expires_in }, "Tokens obtained successfully");

    const driveResponse = await fetch("https://graph.microsoft.com/v1.0/me/drive", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let driveInfo = "";
    if (driveResponse.ok) {
      const drive = await driveResponse.json();
      driveInfo = `
        <div class="info">
          <h3>OneDrive Information</h3>
          <code>Drive ID: ${drive.id}</code><br>
          <code>Drive Name: ${drive.name || "Personal"}</code><br>
          <code>Owner: ${drive.owner?.user?.displayName || "N/A"}</code>
        </div>
      `;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authorization Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 900px;
              margin: 30px auto;
              padding: 20px;
              line-height: 1.6;
            }
            .success {
              background: #e8f5e9;
              border-left: 4px solid #4caf50;
              padding: 20px;
              border-radius: 4px;
              margin-bottom: 20px;
            }
            .info {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
            }
            code {
              background: #ffffff;
              padding: 8px;
              display: block;
              border-radius: 4px;
              margin: 5px 0;
              font-family: 'Monaco', 'Courier New', monospace;
              font-size: 12px;
              word-break: break-all;
              border: 1px solid #ddd;
            }
            .copy-btn {
              background: #0078d4;
              color: white;
              border: none;
              padding: 6px 12px;
              border-radius: 4px;
              cursor: pointer;
              margin-top: 5px;
              font-size: 12px;
            }
            .copy-btn:hover { background: #005a9e; }
            h1, h2, h3 { color: #333; }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>Authorization Successful</h1>
            <p>Your tokens have been generated. Copy the values below to your .env file.</p>
          </div>

          ${driveInfo}

          <div class="info">
            <h2>Azure Credentials for .env</h2>
            
            <h3>Access Token (expires in ${Math.floor(tokens.expires_in / 3600)} hours):</h3>
            <code id="access-token">AZURE_ACCESS_TOKEN=${tokens.access_token}</code>
            <button class="copy-btn" onclick="copyToClipboard('access-token')">Copy Access Token</button>

            <h3>Refresh Token:</h3>
            <code id="refresh-token">AZURE_REFRESH_TOKEN=${tokens.refresh_token}</code>
            <button class="copy-btn" onclick="copyToClipboard('refresh-token')">Copy Refresh Token</button>
          </div>

          <div class="warning">
            <h3>Important:</h3>
            <ul>
              <li>Update your .env file with these values</li>
              <li>Keep these tokens secret and never commit them to Git</li>
              <li>The access token expires in ${Math.floor(tokens.expires_in / 3600)} hours</li>
              <li>The refresh token can be used to get new access tokens automatically</li>
              <li>You can now close this window and stop the server (Ctrl+C)</li>
            </ul>
          </div>

          <script>
            function copyToClipboard(elementId) {
              const element = document.getElementById(elementId);
              const text = element.textContent;
              navigator.clipboard.writeText(text).then(() => {
                alert('Copied to clipboard');
              }).catch(err => {
                console.error('Failed to copy:', err);
              });
            }
          </script>
        </body>
      </html>
    `);

    console.log("\n=== SUCCESS ===\n");
    console.log("Tokens generated. Copy these to your .env file:\n");
    console.log(`AZURE_ACCESS_TOKEN=${tokens.access_token}\n`);
    console.log(`AZURE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log(`\nAccess token expires in: ${Math.floor(tokens.expires_in / 3600)} hours`);
    console.log("\nYou can now stop the server (Ctrl+C)\n");
  } catch (error) {
    log.error({ error }, "Failed to exchange authorization code for tokens");
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Token Exchange Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
            }
            .error {
              background: #ffebee;
              border-left: 4px solid #f44336;
              padding: 20px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Token Exchange Failed</h1>
            <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
            <p>Check the console for more details.</p>
          </div>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, async () => {
  console.log("\n=== OAuth Server Started ===\n");
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`Redirect URI: ${REDIRECT_URI}\n`);
  console.log("IMPORTANT: Make sure your Azure App Registration has this redirect URI:");
  console.log(`  ${REDIRECT_URI}\n`);
  console.log("To add it:");
  console.log("  1. Go to Azure Portal > App Registrations > Your App");
  console.log("  2. Go to Authentication > Add a platform > Web");
  console.log(`  3. Add redirect URI: ${REDIRECT_URI}`);
  console.log("  4. Click Configure\n");
  console.log("Opening browser...\n");

  try {
    await open(`http://localhost:${PORT}`);
  } catch (error) {
    console.log("Could not open browser automatically.");
    console.log(`Please open this URL manually: http://localhost:${PORT}\n`);
  }
});
