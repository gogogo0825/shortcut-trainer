import windows from "./standards/windows.json";
import excel from "./standards/excel.json";
import word from "./standards/word.json";
import powerpoint from "./standards/powerpoint.json";
import vscode from "./standards/vscode.json";
import browser from "./standards/browser.json";
import { validateQuestions } from "./validateQuestions";

const categories = [windows, excel, word, powerpoint, vscode, browser];
export const sampleQuestions = validateQuestions([
  ...categories.map((questions) => questions[0]),
  ...categories.flatMap((questions) => questions.slice(1)),
]);
