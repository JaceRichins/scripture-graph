import { Modal, Notice, Setting, requestUrl } from 'obsidian';
import type { SGState } from '../state';

export class FamilyConnectModal extends Modal {
  private timer: number | undefined;
  private includeSpouse = true;
  constructor(private s: SGState, private done?: () => void) { super(s.app); }
  private async call(path: string, body?: unknown) {
    if (!this.s.device.deviceToken) throw Error('Join the vault first.');
    const response = await requestUrl({ url: this.s.settings.serverUrl.replace(/\/$/,'')+'/familysearch/'+path,
      method: body===undefined?'GET':'POST', headers: { authorization: 'Bearer '+this.s.device.deviceToken,'content-type':'application/json' },
      ...(body===undefined?{}:{body:JSON.stringify(body)}), throw:false });
    if (response.status!==200) throw Error(response.json?.error || 'Could not reach your family connection.');
    return response.json;
  }
  onOpen() {
    const el=this.contentEl;el.createEl('h2',{text:'Your family stories'});
    el.createEl('p',{text:'Connect FamilySearch to build your private tree and find stories in your ancestors’ records. You sign in on FamilySearch; your password is never collected here.'});
    el.createEl('p',{text:'Story text is processed by the family server’s AI service. Photos and original documents stay on FamilySearch. Selected original stories can receive a saved GPU voice recording.'});
    new Setting(el).setName('Include my spouse’s family').setDesc('Includes a spouse branch visible to your account. Multiple spouse links require a choice. This does not access a spouse’s separate private account.')
      .addToggle(t=>t.setValue(true).onChange(v=>{this.includeSpouse=v;}));
    const status=el.createEl('p',{text:'Checking connection…'});
    const progress=el.createEl('p');
    const spouseChoice=el.createDiv();let spouseOptions='';
    let busy=false;
    new Setting(el).addButton(b=>b.setButtonText('Connect FamilySearch').setCta().onClick(async()=>{
      if(busy)return;busy=true;b.setDisabled(true);
      try { const data=await this.call('connect',{includeSpouse:this.includeSpouse});window.open(data.url,'_blank'); }
      catch(e){new Notice((e as Error).message,10000);}
      finally{busy=false;b.setDisabled(false);}
    })).addButton(b=>b.setButtonText('Done').onClick(()=>this.close()));
    new Setting(el).addButton(b=>b.setButtonText('Disconnect FamilySearch').onClick(async()=>{
      try{await this.call('disconnect',{});await refresh();new Notice('Disconnected. Imported stories were kept.');}
      catch(e){new Notice((e as Error).message);}
    }));
    const refresh=async()=>{
      try {
        const data=await this.call('status');
        const labels:Record<string,string>={not_connected:'Not connected',queued:'Your family import is queued',running:'Reading family records and preparing stories',ready:'Available records have been processed',needs_review:'Some records or processing steps need attention',needs_reconnect:'Sign in again to continue your saved import',disconnected:'Disconnected'};
        status.setText(data.message || labels[data.status] || 'Checking your import');
        const p=data.progress || {};
        const choices=JSON.stringify(p.spouseCandidates ?? []);
        if(choices!==spouseOptions){
          spouseOptions=choices;spouseChoice.empty();
          if(p.spouseCandidates?.length){
            spouseChoice.createEl('p',{text:'FamilySearch shows more than one spouse link. Choose the branch to include.'});
            for(const person of p.spouseCandidates)new Setting(spouseChoice).setName(person.name).addButton(b=>b.setButtonText('Include this branch').onClick(async()=>{
              try{await this.call('spouse',{personId:person.id});new Notice('Spouse branch queued.');await refresh();}catch(e){new Notice((e as Error).message);}
            }));
          }
        }
        progress.setText(p.message || (p.ancestorsRead!==undefined?`${p.ancestorsRead} people read · ${p.stories ?? 0} stories · ${p.unreadDocuments ?? 0} documents still need reading` : 'You can keep using the vault while your stories are prepared.'));
      }catch{status.setText('The family connection service is not available yet. Your existing tree and stories are unchanged.');}
    };
    void refresh();this.timer=window.setInterval(()=>void refresh(),15000);
  }
  onClose(){if(this.timer!==undefined)window.clearInterval(this.timer);this.contentEl.empty();this.done?.();}
}
