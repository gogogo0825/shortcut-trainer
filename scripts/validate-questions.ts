import { sampleQuestions } from "../src/data/sampleQuestions";
import { duplicateShortcutCandidates, validateQuestions } from "../src/data/validateQuestions";

const questions = validateQuestions(sampleQuestions);
console.log(`標準問題: ${questions.length}件 / 目標: 約180件`);
for (const category of ["windows", "excel", "word", "powerpoint", "vscode", "browser"] as const) {
  const items = questions.filter((q) => q.category === category);
  console.log(`${category}: ${items.length}件 / 出典確認済み ${items.filter((q) => q.verification !== "pending").length}件 / 実機確認済み ${items.filter((q) => q.verification === "device_checked").length}件`);
  console.log(`  初級 ${items.filter((q) => q.difficulty === "beginner").length} / 中級 ${items.filter((q) => q.difficulty === "intermediate").length} / 上級 ${items.filter((q) => q.difficulty === "advanced").length}`);
}
const duplicates = duplicateShortcutCandidates(questions);
console.log(`同一カテゴリ内の同一キー手順候補: ${duplicates.length}組`);
for (const ids of duplicates) console.log(`  ${ids.join(" / ")}`);
if (process.argv.includes("--details")) {
  for (const q of questions) {
    console.log(`${q.id} | ${q.category} | revision ${q.revision} | ${q.action} | ${q.verification} | ${q.source.publisher} | ${q.source.url ?? "URL未確認"} | ${q.source.checkedAt ?? "確認日未記録"} | ${q.platform.join(", ")} | ${q.appVersions?.join(", ") || "バージョン未記録"} | ${q.layout}`);
  }
}
