import { execSync } from 'child_process';
import * as vscode from 'vscode';
import { workspace, languages, DefinitionProvider, TextDocument, CancellationToken, Position, DefinitionLink, Range, window, Uri } from 'vscode';

let isExecFirstTime:boolean = true;

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(languages.registerDefinitionProvider(
        {language: 'verilog'}, new VerilogDocumentDifinitionProvider()
    ));

    context.subscriptions.push(languages.registerDefinitionProvider(
        {language: 'systemverilog'}, new VerilogDocumentDifinitionProvider()
    ));

    context.subscriptions.push(window.onDidChangeActiveTextEditor((event) =>{
        ctags.execCtagsSync();
    }));

    context.subscriptions.push(workspace.onDidOpenTextDocument((event) =>{
        if(isExecFirstTime){
            ctags.execCtagsSync();
            isExecFirstTime = false;
        }
    }));

    context.subscriptions.push(workspace.onDidSaveTextDocument((event) =>{
        ctags.execCtagsSync();
    }));
}


class VerilogDocumentDifinitionProvider implements DefinitionProvider {
    public provideDefinition(document: TextDocument, position: Position, token: CancellationToken) : Promise<DefinitionLink[]>{
        return new Promise((resolve, reject) => {
            const wordRange = document.getWordRangeAtPosition(position);
            if (!wordRange) {
                return;
            }

            let definitions: DefinitionLink[] = [];

            for (const ctag of CtagsSymbol.ctags){
                const currentWord = document.getText(wordRange);

                if(currentWord === ctag.name){
                    definitions.push({
                        targetUri: ctag.uri,
                        targetRange: ctag.range,
                        targetSelectionRange:  ctag.range
                    });
                    resolve(definitions);
                    return;
                }
            }
            reject();
        });
    }
}

function getLineNumber(lineSp:string):number{
    const temp = lineSp.split(';');
    return parseInt(temp[0]) - 1;
}
class Ctags{
    name: string;
    uri: Uri;
    range: vscode.Range;

    constructor(name:string, uri:Uri, range:Range) {
        this.name = name;
        this.uri = uri;
        this.range = range;
    }
}

class CtagsSymbol {
    static ctags: Ctags[];

    constructor() {
        CtagsSymbol.ctags = [];
    }

    execCtagsSync() {
        console.log("exec ctags");
        let currentDir = "";
        const folders = workspace.workspaceFolders;
        
        if (folders !== undefined && folders.length === 1) {
            currentDir = folders[0].uri.fsPath;
        }
        if(currentDir !== "") {
            CtagsSymbol.ctags.splice(0);

            process.chdir(currentDir);
            const stdout = execSync('ctags -f - --fields=+K -u -n -R --languages=SystemVerilog --languages=+Verilog');
            const ctagsOut:String = stdout.toString();
            const ctagsSplit = ctagsOut.split('\r\n');
            ctagsSplit.pop();

            for (const ctagsLine of ctagsSplit){
                const def = ctagsLine.split(/\t/);
                const defName = def[0];
                const defPath = currentDir + '\\' + def[1].replace('/', '\\');
                const defLineNum = getLineNumber(def[2]);
                const deftype = def[3];
                const posStart = new vscode.Position(defLineNum, 0);
                const posEnd = new vscode.Position(defLineNum, Number.MAX_VALUE);
    
                if(deftype === "module"){
                    const name = defName;
                    const uri = vscode.Uri.file(defPath);
                    const range = new Range(posStart, posEnd);
                    const ctag = new Ctags(name, uri, range);

                    CtagsSymbol.ctags.push(ctag);
                }
            }
        }
    }
}

let ctags = new CtagsSymbol();