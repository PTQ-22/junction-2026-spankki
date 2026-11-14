#!/usr/bin/env bash
# Rebuild the standalone Release app (JS bundled at build time, no Metro / dev overlays),
# install it on the simulator and launch it. Run from app/: `npm run ios:release`.
# Override the target with SIM_UDID=<udid>.
set -euo pipefail
cd "$(dirname "$0")/.."

SIM="${SIM_UDID:-A14FE90E-7BD6-4424-9374-22D8906D7647}"
BUNDLE_ID="fi.junction.taimi"
DD="$HOME/Library/Developer/Xcode/DerivedData"

[ -d ios ] || CI=1 npx expo prebuild --platform ios

start=$(date +%s)
xcodebuild -workspace ios/Taimi.xcworkspace -scheme Taimi -configuration Release \
  -sdk iphonesimulator -destination "id=$SIM" -quiet build

APP=$(ls -td "$DD"/Taimi-*/Build/Products/Release-iphonesimulator/Taimi.app | head -1)
xcrun simctl install "$SIM" "$APP"
# pre-approve the taimi:// scheme so `simctl openurl` doesn't show "Open in Taimi?"
xcrun simctl spawn "$SIM" defaults write com.apple.launchservices.schemeapproval \
  "com.apple.CoreSimulator.CoreSimulatorBridge-->taimi" -string "$BUNDLE_ID"
xcrun simctl launch --terminate-running-process "$SIM" "$BUNDLE_ID"
echo "ios:release done in $(( $(date +%s) - start ))s ($APP)"
