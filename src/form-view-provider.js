const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const open = require("open");

class FormViewProvider {
  constructor(context, uri) {
    this.dbFilePath = path.join(__dirname, "./db.json");
    this.getFolderPath(uri);
    this.createStatusBarItem();
    this.createWebviewPanel();
    this.getWebviewHtml(context);
    this.postMessage();
    this.onDidReceiveMessage(context);
    this.onDidDispose();
  }
  getFolderPath(uri) {
    const documentOrFolderPath = uri.fsPath;
    // 通过路径 查找文件相关的属性
    const documentOrFolderOption = fs.lstatSync(documentOrFolderPath);
    // 判断 文件相关的属性 的 isFile 是不是文件 如果是 就将文件地址保存下来 作为后面的参数使用
    if (documentOrFolderOption.isFile()) {
      this.folderPath = path.dirname(documentOrFolderPath);
    } else {
      this.folderPath = documentOrFolderPath;
    }
  }
  createStatusBarItem() {
    // 创建vscode 下面的状态栏
    this.statusBarItem = vscode.window.createStatusBarItem();
    this.statusBarItem.text = `目标文件夹：${this.folderPath}`;
    this.statusBarItem.color = "yellow";
    this.statusBarItem.show();
  }
  createWebviewPanel() {
    this.webviewPanel = vscode.window.createWebviewPanel(
      "formMaker",
      "表单生成器",
      vscode.ViewColumn.One,
      {
        enableScripts: true, // 启用JS，默认禁用
        retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
      }
    );
    this.webviewPanel.onDidChangeViewState(() => {
      if (this.webviewPanel.visible) {
        this.statusBarItem.show();
      } else {
        this.statusBarItem.hide();
      }
    });
  }

  getWebviewHtml(context) {
    // 文件的绝对地址
    const resourcePath = path.join(context.extensionPath, "src/index.html");
    // 文件夹的绝对地址
    const documentPath = path.dirname(resourcePath);
    let html = fs.readFileSync(resourcePath, "utf-8");
    // vscode不支持直接加载本地资源，需要替换成其专有路径格式，这里只是简单的将样式和JS的路径替换
    html = html.replace(
      /(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g,
      (m, $1, $2) => {
        return (
          $1 +
          vscode.Uri.file(path.resolve(documentPath, $2))
            .with({ scheme: "vscode-resource" })
            .toString() +
          '"'
        );
      }
    );
    this.webviewPanel.webview.html = html;
  }

  postMessage() {
    this.webviewPanel.webview.postMessage({
      cmd: "setPageUrl",
      data: {
        src:
          vscode.workspace.getConfiguration().get("FormMaker.url") +
          "&t=" +
          new Date(),
        db: JSON.parse(fs.readFileSync(this.dbFilePath).toString() || "{}"),
      },
    });
  }

  onDidReceiveMessage(context) {
    // 技术参考来自于 http://blog.haoji.me/vscode-plugin-webview.html
    const callbacks = {
      writeFile: async (message, vscode, dirPath) => {
        const { fileName, code } = message.data;
        const filePath = path.join(dirPath, fileName);
        await fs.writeFileSync(filePath, code);
        vscode.window.showInformationMessage(`文件${fileName}创建成功`);
      },

      setStorageItem: (message) => {
        const { key, val } = message.data;
        const dbContent = fs.readFileSync(this.dbFilePath).toString();
        if (dbContent) {
          const json = JSON.parse(dbContent);
          json[key] = val;
          fs.writeFileSync(this.dbFilePath, JSON.stringify(json));
        }
      },
      openUrl: (message) => {
        open(message.data.url);
      },
    };
    // 接收通讯
    this.webviewPanel.webview.onDidReceiveMessage(
      (message) => {
        if (message.cmd && message.data) {
          const method = callbacks[message.cmd];
          if (method) method(message, vscode, this.folderPath);
        } else {
          vscode.window.showInformationMessage(`没有与消息对应的方法`);
        }
      },
      undefined,
      context.subscriptions
    );
  }
  onDidDispose() {
    this.webviewPanel.onDidDispose((e) => {
      this.statusBarItem.dispose();
    });
  }
}

module.exports = FormViewProvider;
