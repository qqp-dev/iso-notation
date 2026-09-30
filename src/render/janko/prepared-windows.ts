/* Round-local complete-system reuse. Not a global cache, sparse array, page
 * admission substitute or full-score clean verdict. Production width admission
 * still sees the complete immutable score and its real source-bar boundaries. */
import type { QuantizedGridScore } from '../../model/types';
import { computePageGeometry, layoutJankoSystem, renderSystem, systemCompleteInkBounds, systemPaintedInkBoxes, type JankoSystemLayout } from './engine';
import { resolveJankoOptions, resolveJankoTokens, type JankoLayoutOptions, type JankoTokens, type ResolvedJankoLayoutOptions, type ResolvedJankoTokens, type JankoPageGeometry } from './types';
import { renderJankoStyleDefs } from './elements/style';
import { projectVoiceFields, type VoiceField } from './voice-fields';
export interface WindowRequest { measureStart:number; measureCount:number }
const fingerprint=(value:unknown)=>JSON.stringify(value,(_key,v)=>v instanceof Map?{mapEntries:[...v]}:v instanceof Set?{setEntries:[...v]}:v);
const signature=(score:QuantizedGridScore,o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens)=>fingerprint({score,o,t});
// DOM-only namespace, never an identity/admission check (validation uses full data).
const domNamespace=(s:string)=>{let a=2166136261,b=5381;for(const c of s){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return `${a>>>0}-${b>>>0}`;};
export class PreparedJankoWindows {
 readonly scope='window-scoped' as const;
 readonly domId:string;
 readonly options:ResolvedJankoLayoutOptions;
 readonly tokens:ResolvedJankoTokens;
 readonly geometry:JankoPageGeometry;
 readonly systems:ReadonlyMap<number,JankoSystemLayout>;
 readonly voiceFields=new Map<number,VoiceField[]>();
 private readonly fingerprint:string;
 private readonly layoutIdentities=new Map<number,{layout:JankoSystemLayout;fingerprint:string}>();
 private readonly fieldFingerprints=new Map<number,string>();
 private readonly beamFunctions=new Map<JankoSystemLayout,JankoSystemLayout['beams'][number]['beamY'][]>();
 constructor(readonly score:QuantizedGridScore,readonly windows:readonly WindowRequest[],options?:Partial<JankoLayoutOptions>,tokens?:Partial<JankoTokens>){
  this.options=resolveJankoOptions(options);this.tokens=resolveJankoTokens(tokens);
  this.fingerprint=signature(score,this.options,this.tokens);
  this.domId=domNamespace(this.fingerprint);
  this.geometry=computePageGeometry(this.options,this.tokens,score);
  const map=new Map<number,JankoSystemLayout>();
  const starts=this.geometry.systemBarStarts;
  for(const w of windows){
   if(!Number.isInteger(w.measureStart)||!Number.isInteger(w.measureCount)||w.measureStart<1||w.measureCount<1)throw Error('Invalid candidate window');
   const first=w.measureStart-1,last=first+w.measureCount;
   const count=starts?.length ? starts.length-1 : Math.ceil((score.sourceBarTicks?.length?score.sourceBarTicks.length-1:Math.ceil(score.totalTicks/this.tokens.ticksPerMeasure))/this.options.measuresPerSystem);
   for(let index=0;index<count;index++){
    const from=starts?.[index]??index*this.options.measuresPerSystem,to=starts?.[index+1]??from+this.options.measuresPerSystem;
    if(from<last&&to>first&&!map.has(index))map.set(index,layoutJankoSystem(score,this.geometry,index,this.options,this.tokens));
   }
  }
  this.systems=map;
  for(const [index,layout] of map){
    this.layoutIdentities.set(index,{layout,fingerprint:fingerprint(layout)});
    this.beamFunctions.set(layout,layout.beams.map(b=>b.beamY));
    if(this.options.comparisonPitchFields){const fields=projectVoiceFields(layout,score,this.options,this.tokens,this.geometry);this.voiceFields.set(index,fields);this.fieldFingerprints.set(index,fingerprint(fields));for(const f of fields)this.beamFunctions.set(f.layout,f.layout.beams.map(b=>b.beamY));}
  }
 }
 validate(score=this.score,options=this.options,tokens=this.tokens):void{
  if(score!==this.score||signature(score,resolveJankoOptions(options),resolveJankoTokens(tokens))!==this.fingerprint)throw Error('Candidate system reuse refused: source/options/tokens identity mismatch');
  if(this.systems.size!==this.layoutIdentities.size)throw Error('Candidate system reuse refused: incomplete systems');
  for(const [index,l] of this.systems)if(this.layoutIdentities.get(index)?.layout!==l||this.layoutIdentities.get(index)?.fingerprint!==fingerprint(l)||index!==l.index||l.scoreRevision!==score||l.geometry.sourceBarTicks!==this.geometry.sourceBarTicks||l.geometry.firstBar!==(this.geometry.systemBarStarts?.[index]??l.geometry.firstBar))throw Error('Candidate system reuse refused: system identity mismatch');
  for(const [index,fields] of this.voiceFields)if(this.fieldFingerprints.get(index)!==fingerprint(fields))throw Error('Candidate system reuse refused: projected field identity mismatch');
  if(this.voiceFields.size!==this.fieldFingerprints.size)throw Error('Candidate system reuse refused: incomplete projected fields');
  for(const l of [...this.systems.values(),...[...this.voiceFields.values()].flatMap(f=>f.map(v=>v.layout))])if(!this.beamFunctions.has(l)||l.beams.some((b,i)=>this.beamFunctions.get(l)?.[i]!==b.beamY))throw Error('Candidate system reuse refused: beam function / field layout identity mismatch');
 }
 auditLayouts():JankoSystemLayout[]{this.validate();return this.options.comparisonPitchFields?[...this.voiceFields.values()].flatMap(fields=>fields.map(f=>f.layout)):[...this.systems.values()];}
 fieldsFor(base:JankoSystemLayout):Array<{label:string;layout:JankoSystemLayout}>{this.validate();return this.options.comparisonPitchFields?this.voiceFields.get(base.index)??[]:[{label:'',layout:base}];}
 containing(w:WindowRequest):JankoSystemLayout[]{
  this.validate();
  return [...this.systems.values()].filter(l=>{const from=l.geometry.firstBar??l.index*this.options.measuresPerSystem;return from<w.measureStart-1+w.measureCount&&from+l.geometry.measuresPerSystem>w.measureStart-1;}).sort((a,b)=>a.index-b.index);
 }
}
/** Engine paint at its original coordinates, framed by complete physical/broad
 * ink bounds. Separate systems stack here as comparative windows, not pages. */
export function renderPreparedJankoWindow(prepared:PreparedJankoWindows,w:WindowRequest,completeSystems=false,occurrenceId='window'):string{
 prepared.validate();const layouts=prepared.containing(w),o=prepared.options,t=prepared.tokens;
 if(!layouts.length)throw Error('Candidate window has no prepared containing system');
 let y=o.comparisonPitchFields?49:o.sharedRhCarrier?37:15,width=0;const bodies:string[]=o.comparisonPitchFields?['<text x="6" y="12" font-size="7pt" fill="#111111">Aligned pitch + onset: ONE key.</text><text x="6" y="24" font-size="7pt" fill="#111111">Each voice keeps its written value.</text><text x="6" y="36" font-size="7pt" fill="#111111">Final expression row: ALL hands.</text>']:o.sharedRhCarrier?['<text x="6" y="12" font-size="7pt" fill="#111111">RH v1: single stem. RH v2: double stem.</text><text x="6" y="24" font-size="7pt" fill="#111111">Stream style is NOT duration. Follow each stream.</text>']:[];
 for(const base of layouts)for(const field of prepared.fieldsFor(base)){const l=field.layout,g=l.geometry,from=g.firstBar??l.index*o.measuresPerSystem;
  const localStart=Math.max(0,w.measureStart-1-from),localEnd=Math.min(g.measuresPerSystem,w.measureStart-1+w.measureCount-from);
  const x0=completeSystems?g.staffLeft-20:(g.measureEdges?.[localStart]??g.staffLeft+localStart*g.measureWidth)-8;
  const x1=completeSystems?g.staffRight+8:(g.measureEdges?.[localEnd]??g.staffLeft+localEnd*g.measureWidth)+8;
  const bounds=systemCompleteInkBounds(l,o,t),boxes=systemPaintedInkBoxes(l,o,t);
  const top=Math.min(bounds.top,...boxes.map(b=>b.y0))-8,bottom=Math.max(bounds.bottom,...boxes.map(b=>b.y1))+8;
  width=Math.max(width,x1-x0);
  const id=`candidate-${occurrenceId.replace(/[^a-z0-9-]/gi,'-')}-${prepared.domId}-clip-${l.index}-${w.measureStart}-${completeSystems?'system':'crop'}-${bodies.length}`;
  if(field.label){bodies.push(`<text x="6" y="${y+5}" font-size="7pt" fill="#111111">${field.label}</text>`);y+=18;}
  bodies.push(`<defs><clipPath id="${id}"><rect x="${x0}" y="${top}" width="${x1-x0}" height="${bottom-top}"/></clipPath></defs><g transform="translate(${-x0} ${y-top})"><g clip-path="url(#${id})">${renderSystem(prepared.score,g,l.index,o,t,l)}</g></g>`);
  y+=bottom-top+12;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${y}pt" viewBox="0 0 ${width} ${y}" data-diagnostic-scope="window-scoped">${renderJankoStyleDefs(t)}<rect width="${width}" height="${y}" fill="#FFFFFF"/>${bodies.join('\n')}</svg>`;
}
