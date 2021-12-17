/** @typedef { import("Bitburner").BitBurner } NS */
/** @type NS */
let ns = null;

const repo = "itsjxck/bitburner-scripts";
const apiBase = `https://api.github.com/repos/${repo}`;
const rawBase = `https://raw.githubusercontent.com/${repo}`;

const doFetch = async (url) => (await fetch(url)).json();

const getCommitSha = async () => {
  const json = await doFetch(`${apiBase}/branches/main`);

  return json.commit.sha;
};

const getCommitMessage = async (sha) => {
  const json = await doFetch(`${apiBase}/commits/${sha}`);

  return json.commit.message;
};

const getFileList = async (sha) => {
  const json = await doFetch(`${apiBase}/git/trees/${sha}?recursive=1`);

  return json.tree.filter((f) => f.type === "blob" && f.path.endsWith(".js"));
};

/** @param { NS } _ns  */
export async function main(_ns) {
  ns = _ns;
  const commitSha = await getCommitSha();
  const commitMessage = await getCommitMessage(commitSha);
  const files = await getFileList(commitSha);
  for (const file of files) {
    await ns.wget(
      `${rawBase}/main/${file.path}?ts=${new Date().getTime()}`,
      `/${repo}/${file.path}`
    );
  }
  ns.tprint(`[${repo}]: ${commitSha} - ${commitMessage}`);
}
