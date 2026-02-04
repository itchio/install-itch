#!/bin/bash
set -euo pipefail

# Signs and notarizes a macOS .app bundle, creating a DMG for distribution.
# Expects signing certificate to already be imported into keychain.
#
# Required environment variables:
#   APPLE_ID                    - Apple ID for notarization
#   APPLE_APP_SPECIFIC_PASSWORD - App-specific password for Apple ID
#   APPLE_TEAM_ID               - Apple Team ID
#
# Usage: ./release/sign-darwin.sh <app-name>
#   Example: ./release/sign-darwin.sh itch

APP_NAME="${1:?Usage: $0 <app-name>}"

SIGN_KEY="Developer ID Application: itch corp. (AK2D34UDP2)"
ENTITLEMENTS_PATH="./entitlements.plist"

# Verify required environment variables
: "${APPLE_ID:?Environment variable APPLE_ID is required}"
: "${APPLE_APP_SPECIFIC_PASSWORD:?Environment variable APPLE_APP_SPECIFIC_PASSWORD is required}"
: "${APPLE_TEAM_ID:?Environment variable APPLE_TEAM_ID is required}"

APP_BUNDLE="artifacts/install-${APP_NAME}/darwin-universal/Install ${APP_NAME}.app"

if [ ! -d "$APP_BUNDLE" ]; then
  echo "Error: ${APP_BUNDLE} not found"
  exit 1
fi

echo "=== Signing ${APP_NAME} ==="

# Restore execute permission (lost during GitHub Actions artifact upload/download)
chmod +x "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}-setup"

# Sign the binary inside the .app
codesign --options runtime --timestamp --entitlements "$ENTITLEMENTS_PATH" \
  --force --verbose --sign "$SIGN_KEY" "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}-setup"

# Sign the .app bundle
codesign --options runtime --timestamp --entitlements "$ENTITLEMENTS_PATH" \
  --deep --force --verbose --sign "$SIGN_KEY" "${APP_BUNDLE}"

# Verify signature
codesign --verify -vvvv "${APP_BUNDLE}"

# Create DMG
mkdir -p staging
hdiutil create -volname "Install ${APP_NAME}" \
  -srcfolder "${APP_BUNDLE}" \
  -ov -format UDZO "staging/Install ${APP_NAME}.dmg"

# Sign the DMG
codesign --force --verbose --sign "$SIGN_KEY" "staging/Install ${APP_NAME}.dmg"
codesign --verify -vvvv "staging/Install ${APP_NAME}.dmg"

# Notarize
echo "Notarizing ${APP_NAME}..."
xcrun notarytool submit "staging/Install ${APP_NAME}.dmg" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

# Staple
xcrun stapler staple "staging/Install ${APP_NAME}.dmg"
xcrun stapler validate "staging/Install ${APP_NAME}.dmg"

# Replace .app with signed DMG for deployment
rm -rf "${APP_BUNDLE}"
mv "staging/Install ${APP_NAME}.dmg" "artifacts/install-${APP_NAME}/darwin-universal/"

echo "=== ${APP_NAME} signed and notarized ==="
