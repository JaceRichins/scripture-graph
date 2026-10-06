import { Modal, Notice, Setting, type App } from 'obsidian';
import { SCENES } from './scenes';
import { wideScene, type SceneCache } from './sceneCache';
export class SceneStorageModal extends Modal {
  constructor(app: App, private cache: SceneCache, private limit:()=>number, private saveLimit:(value:number)=>Promise<void>) { super(app); }
  onOpen() { void this.render(); }
  private async render() {
    const status=await this.cache.status();this.contentEl.empty();
    this.contentEl.createEl('h2',{text:'Scene storage'});
    this.contentEl.createEl('p',{text:`${(status.bytes/1_000_000).toFixed(1)} MB downloaded · ${status.count} images. Starter scenes are included in the plugin. Your notes and documents are never removed.`});
    new Setting(this.contentEl).setName('Storage limit').setDesc('Older unpinned downloads are removed automatically. Favorites stay offline.').addDropdown(d=>{
      for(const mb of [25,50,100,250])d.addOption(String(mb),`${mb} MB`);
      d.setValue(String(this.limit())).onChange(async value=>{try{await this.cache.setLimit(Number(value));await this.saveLimit(Number(value));}catch(e){new Notice((e as Error).message);}void this.render();});
    });
    new Setting(this.contentEl).setName('Free up space').setDesc('Remove downloaded scenes except offline favorites. Scenes download again when needed.').addButton(b=>b.setButtonText('Clear unpinned downloads').onClick(async()=>{b.setDisabled(true);try{await this.cache.clearUnused();await this.render();}catch(e){new Notice((e as Error).message);b.setDisabled(false);}}));
    this.contentEl.createEl('h3',{text:'Keep offline'});
    this.contentEl.createEl('p',{text:'Turning a scene on downloads the version for this screen. If you rotate or resize, the other version downloads when used. Scene artwork is an interpretation, not a historical photograph.'});
    for(const scene of SCENES)new Setting(this.contentEl).setName(`${scene.emoji} ${scene.name}`).addToggle(t=>t.setValue(status.pins.includes(scene.id)).onChange(async keep=>{
      t.setDisabled(true);try{await this.cache.pin(scene.id,keep,wideScene(window.innerWidth,window.innerHeight));await this.render();}catch(e){new Notice((e as Error).message);t.setValue(!keep);t.setDisabled(false);}
    }));
  }
}
