/** Plan a static preview without checking out or executing a fork's code. */
export default async function planPreview({ github, context, core }) {
  const { owner, repo } = context.repo;
  const repository = `${owner}/${repo}`;
  const skip = (reason) => core.info(reason);
  let number;
  let mode;
  let artifact;
  let headSha;
  let headRepo;

  if (context.eventName === 'workflow_run') {
    const run = context.payload.workflow_run;
    if (run.event !== 'pull_request' || run.conclusion !== 'success')
      return skip('Only successful pull-request builds can supply previews.');
    const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
      owner,
      repo,
      run_id: run.id,
      per_page: 100,
    });
    const candidates = artifacts.filter((item) =>
      /^preview-(?:remove-)?pr-[1-9][0-9]*$/.test(item.name),
    );
    if (!candidates.length) return skip('No fork preview artifact on this run.');
    if (candidates.length !== 1)
      throw new Error('A run must have exactly one preview or removal artifact.');
    const candidate = candidates[0];
    if (candidate.expired) return skip('The preview artifact has expired.');
    const match = /^preview-(remove-)?pr-([1-9][0-9]*)$/.exec(candidate.name);
    mode = match[1] ? 'remove' : 'deploy';
    number = Number(match[2]);
    artifact = candidate.name;
    headSha = run.head_sha;
    headRepo = run.head_repository?.full_name;
  } else if (context.eventName === 'pull_request') {
    const eventPr = context.payload.pull_request;
    number = eventPr.number;
    mode = context.payload.action === 'closed' ? 'remove' : 'deploy';
    artifact = 'web-dist';
    headSha = eventPr.head.sha;
    headRepo = eventPr.head.repo?.full_name;
    if (headRepo !== repository)
      return skip('Forks publish through the trusted workflow_run handler.');
  } else {
    throw new Error('Unsupported preview event.');
  }

  if (!Number.isSafeInteger(number) || number <= 0) throw new Error('Invalid pull request number.');
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: number });
  if (pr.base.repo.full_name !== repository) throw new Error('Unexpected target repository.');

  if (mode === 'deploy') {
    if (pr.state !== 'open' || pr.head.sha !== headSha || pr.head.repo?.full_name !== headRepo)
      return skip('The pull request was closed or changed since this build.');
    if (context.eventName === 'workflow_run' && headRepo === repository)
      return skip('Same-repository previews publish in the original workflow.');
  } else {
    // A merged PR's close run may point at the new base SHA. Current closed state,
    // not the build SHA, authorizes removal. A reopened PR must keep its preview.
    if (pr.state !== 'closed') return skip('The pull request is open; keep its preview.');
    try {
      const { data } = await github.rest.repos.getContent({
        owner,
        repo,
        path: `pr-preview/pr-${number}`,
        ref: 'gh-pages',
      });
      if (Array.isArray(data) && data.length === 0) return skip('The preview directory is empty.');
      if (!Array.isArray(data)) throw new Error('Expected a preview directory.');
    } catch (error) {
      if (error.status === 404) return skip('No preview exists to remove.');
      throw error;
    }
  }

  core.setOutput('mode', mode);
  core.setOutput('number', number);
  core.setOutput('artifact', artifact);
}
