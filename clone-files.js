/** @typedef { import("Bitburner").BitBurner } NS */
/** @type NS */
let ns = null;

const apiBase = "https://api.github.com/repos";
const rawBase = "https://raw.githubusercontent.com";
const repo = "itsjxck/bitburner-scripts";

const getCommitSha = async () => {
  const res = await fetch(`${apiBase}/${repo}/branches/main`);
  const json = await res.json();

  return json.commit.sha;
};

const getFileList = async (sha) => {
  const res = await fetch(`${apiBase}/${repo}/git/trees/${sha}?recursive=1`);
  const json = await res.json();

  ns.print(JSON.stringify(json));

  return json.tree.filter((f) => f.type === "blob" && f.path.endsWith(".js"));
};

/** @param { NS } _ns  */
export async function main(_ns) {
  ns = _ns;
  const commitSha = await getCommitSha();
  const files = await getFileList(commitSha);
  for (const file of files) {
    await ns.wget(
      `${rawBase}/${repo}/main/${file.path}`,
      `/${repo}/${file.path}`
    );
  }
  ns.tprint(`Cloned ${repo} [${commitSha}]`);
}
