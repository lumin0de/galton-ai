const SKILLS_BASE = new URL("../skills/", import.meta.url)

export async function loadSkill(filename: string): Promise<string> {
  try {
    return await Deno.readTextFile(new URL(filename, SKILLS_BASE))
  } catch {
    return ""
  }
}
