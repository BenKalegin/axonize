#!/bin/bash
# Patches Electron binary plists so the dock/taskbar shows "Axonize" in dev mode.
DIST="node_modules/electron/dist/Electron.app"
MAIN="$DIST/Contents/Info.plist"

if [ ! -f "$MAIN" ]; then
  exit 0
fi

# Patch main app plist
plutil -replace CFBundleName -string "Axonize" "$MAIN"
plutil -replace CFBundleDisplayName -string "Axonize" "$MAIN"
plutil -replace CFBundleIdentifier -string "com.axonize.app" "$MAIN"

# Patch all helper app plists
for helper in \
  "$DIST/Contents/Frameworks/Electron Helper.app/Contents/Info.plist" \
  "$DIST/Contents/Frameworks/Electron Helper (Renderer).app/Contents/Info.plist" \
  "$DIST/Contents/Frameworks/Electron Helper (GPU).app/Contents/Info.plist" \
  "$DIST/Contents/Frameworks/Electron Helper (Plugin).app/Contents/Info.plist"; do
  if [ -f "$helper" ]; then
    plutil -replace CFBundleName -string "Axonize Helper" "$helper"
  fi
done

# Clear macOS Launch Services cache so the new name takes effect immediately
if command -v lsregister &>/dev/null; then
  lsregister -kill -r -domain local -domain user 2>/dev/null
elif [ -x "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister" ]; then
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain user 2>/dev/null
fi

echo "Patched Electron.app bundle name to Axonize"
