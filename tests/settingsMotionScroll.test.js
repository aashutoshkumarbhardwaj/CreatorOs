const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getScrollBehavior(motionEffectsEnabled) {
  return !motionEffectsEnabled ? 'auto' : 'smooth';
}

describe('settings.js motionEffects scroll behavior', () => {
  const settingsPath = path.join(__dirname, '..', 'public', 'js', 'pages', 'settings.js');

  it('parses without syntax errors', () => {
    const result = spawnSync(process.execPath, ['--check', settingsPath], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('uses instant scroll when motion effects are off', () => {
    expect(getScrollBehavior(false)).toBe('auto');
    expect(getScrollBehavior(undefined)).toBe('auto');
    expect(getScrollBehavior(null)).toBe('auto');
  });

  it('uses smooth scroll when motion effects are on', () => {
    expect(getScrollBehavior(true)).toBe('smooth');
  });

  it('wires reduced-motion preference into scrollIntoView', () => {
    const source = fs.readFileSync(settingsPath, 'utf8');
    expect(source).toContain(
      "!userData.preferences?.motionEffects ? 'auto' : 'smooth'"
    );
  });
});
