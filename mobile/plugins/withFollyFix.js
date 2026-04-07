/**
 * Fix 'folly/coro/Coroutine.h' file not found on RN 0.81 / Expo SDK 54.
 * Injects FOLLY_CFG_NO_COROUTINES into the post_install block.
 *
 * See: https://github.com/facebook/react-native/issues/53575
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withFollyFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.warn('[withFollyFix] Podfile not found, skipping');
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, 'utf-8');

      if (podfile.includes('FOLLY_CFG_NO_COROUTINES')) {
        return config;
      }

      // Find "post_install do |installer|" and inject right after it
      const postInstallRegex = /post_install\s+do\s+\|installer\|/;
      const match = podfile.match(postInstallRegex);

      if (match) {
        const insertAt = match.index + match[0].length;
        const patch = `
    # [withFollyFix] Disable Folly coroutines to fix missing header
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |bc|
        flags = bc.build_settings['OTHER_CPLUSPLUSFLAGS'] || ['$(inherited)']
        flags << '-DFOLLY_CFG_NO_COROUTINES=1' unless flags.include?('-DFOLLY_CFG_NO_COROUTINES=1')
        flags << '-DFOLLY_HAVE_CLOCK_GETTIME=1' unless flags.include?('-DFOLLY_HAVE_CLOCK_GETTIME=1')
        bc.build_settings['OTHER_CPLUSPLUSFLAGS'] = flags
      end
    end
`;
        podfile = podfile.slice(0, insertAt) + patch + podfile.slice(insertAt);
        fs.writeFileSync(podfilePath, podfile, 'utf-8');
        console.log('[withFollyFix] Patched Podfile successfully');
      } else {
        console.warn('[withFollyFix] Could not find post_install block in Podfile');
      }

      return config;
    },
  ]);
};
