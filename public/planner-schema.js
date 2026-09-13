const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const string=(minLength,maxLength)=>({type:'string',minLength,maxLength});
const list=(items,minItems,maxItems)=>({type:'array',items,minItems,maxItems});
export const briefSchema=object({topic:string(2,120),grade:string(1,40),subject:string(1,60),learningGoal:string(0,500),observedBeliefs:string(0,1600),includeQuickChecks:{type:'boolean'}});
const cardSchema=object({id:string(1,80),claim:string(8,600),rationale:string(1,500),quickCheck:string(0,500),experiment:string(1,600),variable:string(1,100)});
export const planSchema=object({brief:briefSchema,cards:list(cardSchema,1,5)});
const coordinate={type:'number',minimum:0,maximum:1};
const regionSchema=object({field:{type:'string',enum:Object.keys(briefSchema.properties)},label:string(1,100),x:coordinate,y:coordinate,width:coordinate,height:coordinate});
export const briefImportSchema=object({brief:briefSchema,regions:list(regionSchema,0,8),uncertainty:string(1,1200)});
function matches(value,schema){
 if(schema.type==='object')return Boolean(value)&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===schema.required.length&&schema.required.every(key=>Object.hasOwn(value,key)&&matches(value[key],schema.properties[key]));
 if(schema.type==='array')return Array.isArray(value)&&value.length>=schema.minItems&&value.length<=schema.maxItems&&value.every(item=>matches(item,schema.items));
 if(schema.type==='number')return Number.isFinite(value)&&value>=schema.minimum&&value<=schema.maximum;
 if(schema.type==='string')return typeof value==='string'&&(schema.enum?schema.enum.includes(value):value.trim().length>=schema.minLength&&value.length<=schema.maxLength);
 return typeof value===schema.type;
}
export function validateBrief(value){return matches(value,briefSchema);}
export function validatePlan(value){return matches(value,planSchema)&&new Set(value.cards.map(card=>card.id)).size===value.cards.length&&(!value.brief.includeQuickChecks||value.cards.every(card=>card.quickCheck.trim().length>0));}
export function validateBriefImport(value){return matches(value,briefImportSchema)&&value.regions.every(region=>region.width>0&&region.height>0&&region.x+region.width<=1.000001&&region.y+region.height<=1.000001);}
