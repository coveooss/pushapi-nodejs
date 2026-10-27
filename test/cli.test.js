import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'client-global.js');

/** Runs the CLI in `cwd`, feeding `input` on stdin. Never rejects: the caller inspects the exit code. */
function runCli(args, { cwd, input = '' } = {}) {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, NO_COLOR: '1' } }, (error, stdout, stderr) => {
      resolve({ code: error?.code ?? 0, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

async function workdir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'pushapi-cli-'));
  await cp(path.join(ROOT, 'samples'), path.join(dir, 'samples'), { recursive: true });
  return dir;
}

describe('pushapi CLI', () => {
  it('prints usage with --help', async () => {
    const { code, stdout } = await runCli(['--help']);
    assert.equal(code, 0);
    assert.match(stdout, /Usage: pushapi <File_or_Folder> \[options\]/);
    assert.match(stdout, /--dry-run/);
  });

  it('fails when no file or folder is given', async () => {
    const { code, stderr } = await runCli([]);
    assert.equal(code, 1);
    assert.match(stderr, /You need to specify a FILE or a FOLDER/);
  });

  it('prints the version with --version', async () => {
    const { code, stdout } = await runCli(['--version']);
    assert.equal(code, 0);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+/);
  });

  it('rejects unknown options, extra positionals, and a non-numeric --deleteOlderThan', async () => {
    const cases = [
      [['samples', '--bogus'], /Unknown option '--bogus'/],
      [['a', 'b'], /Too many arguments: a b/],
      [['samples', '-d', 'abc'], /--deleteOlderThan expects a number of hours, got: abc/],
      [['samples', '-d'], /argument missing/],
    ];
    for (const [args, expected] of cases) {
      const { code, stderr } = await runCli(args);
      assert.equal(code, 1, args.join(' '));
      assert.match(stderr, expected);
    }
  });

  it('offers to create the config, and exits cleanly when declined', async () => {
    const cwd = await workdir();
    const { code, stdout, stderr } = await runCli(['samples'], { cwd, input: 'n\n' });
    assert.equal(code, 0);
    assert.match(stderr, /Couldn't load .*\.pushapi-config\.json/);
    assert.match(stdout, /Would you like to create the config file now\?/);
  });

  it('fails instead of hanging when stdin closes during the config prompts', async () => {
    const cwd = await workdir();
    const { code, stderr } = await runCli(['samples'], { cwd, input: 'y\n' });
    assert.equal(code, 1);
    assert.match(stderr, /Input closed before the config was complete/);
  });

  it('creates the config from piped answers, then does a dry run of a folder', async () => {
    const cwd = await workdir();
    const answers = ['y', 'myorg-abc123', 'n', '', 'dev', 'xx-key', ''].join('\n');
    const { code, stdout } = await runCli(['samples', '--dry-run'], { cwd, input: answers });
    assert.equal(code, 0, stdout);

    const config = JSON.parse(await readFile(path.join(cwd, '.pushapi-config.json'), 'utf8'));
    assert.deepEqual(config, { org: 'myorg', source: 'myorg-abc123', apiKey: 'xx-key', platform: 'pushdev.cloud.coveo.com' });

    assert.match(stdout, /Created buffer file \(not pushing\)/);
    assert.match(stdout, /Processed items: 2/);
    const buffer = JSON.parse(await readFile(path.join(cwd, '.pushapi.buffer.1'), 'utf8'));
    assert.equal(buffer.AddOrUpdate.length, 2);
  });

  it('reports a missing payload path with exit code 1', async () => {
    const cwd = await workdir();
    const answers = ['y', 'myorg-abc123', 'n', '', '', 'xx-key', ''].join('\n');
    const { code, stderr } = await runCli(['nope.json'], { cwd, input: answers });
    assert.equal(code, 1);
    assert.match(stderr, /Couldn't find file or folder: nope\.json/);
  });
});
