const vscode = require("vscode");
const FormViewProvider = require("./src/form-view-provider");
function activate(context) {
  const openFormMakerCommand = vscode.commands.registerCommand(
    "v-form.openFormMaker",
    (uri) => {
      return new FormViewProvider(context, uri);
    }
  );
  context.subscriptions.push(openFormMakerCommand);
}
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
