import assert from 'node:assert/strict';
import { test } from 'node:test';
import plan from './preview-plan.mjs';

function fixture({ fork = false, closed = false, artifacts, content = [{}], contentError } = {}) {
  const repository = 'gamestudio42/plot42';
  const pr = {
    number: 12,
    state: closed ? 'closed' : 'open',
    base: { repo: { full_name: repository } },
    head: { sha: 'head-sha', repo: { full_name: fork ? 'contributor/plot42' : repository } },
  };
  const context = {
    repo: { owner: 'gamestudio42', repo: 'plot42' },
    eventName: fork ? 'workflow_run' : 'pull_request',
    payload: {
      action: closed ? 'closed' : 'synchronize',
      pull_request: structuredClone(pr),
      workflow_run: {
        id: 42,
        event: 'pull_request',
        conclusion: 'success',
        head_sha: 'head-sha',
        head_repository: { full_name: pr.head.repo.full_name },
      },
    },
  };
  const output = {};
  const calls = [];
  const artifactsList = artifacts ?? [{ name: closed ? 'preview-remove-pr-12' : 'preview-pr-12' }];
  const github = {
    paginate: async (_route, args) => {
      calls.push(args);
      return artifactsList;
    },
    rest: {
      actions: { listWorkflowRunArtifacts: 'list' },
      pulls: { get: async () => ({ data: pr }) },
      repos: {
        getContent: async (args) => {
          calls.push(args);
          if (contentError) throw contentError;
          return { data: content };
        },
      },
    },
  };
  return {
    pr,
    context,
    output,
    calls,
    run: () =>
      plan({
        github,
        context,
        core: {
          info: () => {},
          setOutput: (k, v) => {
            output[k] = v;
          },
        },
      }),
  };
}

for (const fork of [false, true]) {
  test(`plans an up-to-date ${fork ? 'fork artifact' : 'same-repository build'}`, async () => {
    const f = fixture({ fork });
    await f.run();
    assert.deepEqual(f.output, {
      mode: 'deploy',
      number: 12,
      artifact: fork ? 'preview-pr-12' : 'web-dist',
    });
  });
  for (const change of ['sha', 'repo', 'closed']) {
    test(`skips a ${fork ? 'fork' : 'local'} build when the PR changes: ${change}`, async () => {
      const f = fixture({ fork });
      if (change === 'sha') f.pr.head.sha = 'new-head';
      if (change === 'repo') f.pr.head.repo.full_name = 'someone/else';
      if (change === 'closed') f.pr.state = 'closed';
      await f.run();
      assert.deepEqual(f.output, {});
    });
  }
  test(`removes only the exact closed PR directory (${fork ? 'fork' : 'local'})`, async () => {
    const f = fixture({ fork, closed: true });
    f.context.payload.workflow_run.head_sha = 'merge-sha';
    await f.run();
    assert.equal(f.output.mode, 'remove');
    assert.equal(f.calls.at(-1).path, 'pr-preview/pr-12');
    assert.equal(f.calls.at(-1).ref, 'gh-pages');
  });
  test(`keeps a reopened PR preview (${fork ? 'fork' : 'local'})`, async () => {
    const f = fixture({ fork, closed: true });
    f.pr.state = 'open';
    await f.run();
    assert.deepEqual(f.output, {});
  });
}

for (const contentError of [{ status: 404 }, undefined]) {
  test(`cleanup is idempotent when the branch/directory is ${contentError ? 'missing' : 'empty'}`, async () => {
    const f = fixture({ closed: true, content: [], contentError });
    await f.run();
    await f.run();
    assert.deepEqual(f.output, {});
  });
}
test('cleanup preserves unexpected API errors', async () => {
  const error = Object.assign(new Error('Forbidden'), { status: 403 });
  await assert.rejects(fixture({ closed: true, contentError: error }).run, /Forbidden/);
});
test('rejects ambiguous fork artifacts', async () => {
  const f = fixture({
    fork: true,
    artifacts: [{ name: 'preview-pr-12' }, { name: 'preview-remove-pr-12' }],
  });
  await assert.rejects(f.run, /exactly one/);
});
test('ignores unrelated or expired artifacts and unsuccessful runs', async () => {
  for (const artifacts of [[{ name: 'web-dist' }], [{ name: 'preview-pr-12', expired: true }]]) {
    const f = fixture({ fork: true, artifacts });
    await f.run();
    assert.deepEqual(f.output, {});
  }
  const f = fixture({ fork: true });
  f.context.payload.workflow_run.conclusion = 'failure';
  await f.run();
  assert.deepEqual(f.output, {});
});
test('rejects a mismatched target repository', async () => {
  const f = fixture({ fork: true });
  f.pr.base.repo.full_name = 'another/repo';
  await assert.rejects(f.run, /target repository/);
});
