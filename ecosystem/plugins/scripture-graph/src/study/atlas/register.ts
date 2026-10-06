import { MarkdownRenderChild, Notice, type Plugin } from 'obsidian';
import { renderAtlas } from './maps';

export function registerAtlas(plugin: Plugin, ensure: (path: string) => Promise<boolean>): void {
  const open = async (path: string) => {
    if (!(await ensure(path))) { new Notice('This place page has not reached this device yet. Connect to the family server and try again.'); return; }
    await plugin.app.workspace.openLinkText(path, '');
  };
  plugin.registerMarkdownCodeBlockProcessor('scripture-atlas', (_source, el, ctx) => {
    const child = new MarkdownRenderChild(el);
    ctx.addChild(child);
    child.register(renderAtlas(el, path => { void open(path); }));
  });
  plugin.addCommand({id:'open-scripture-atlas',name:'Open Maps',callback:()=>{void open('AI Library/91 Maps/Maps.md');}});
}
