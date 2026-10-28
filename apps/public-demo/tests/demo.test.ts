// @vitest-environment node
import {it,expect} from 'vitest';
import data from '../lib/case.json';
import {choose,complete,initialState,reset} from '../lib/model';
it('只公开既有合成案例的白名单文本',()=>{
 expect(data.items).toHaveLength(4);
 expect(JSON.stringify(data)).not.toMatch(/candidate_level|scoring_key|source_items|review_reports|expert_decision|API_KEY/);
 for(const item of data.items){expect(item.options).toHaveLength(4);expect(data.segments.some(s=>s.eventId===item.eventId)).toBe(true);}
});
it('选项必须属于当前案例，未答完不能完成体验',()=>{
 const s=initialState();expect(complete(s)).toBe(false);
 expect(()=>choose(s,'bad','A')).toThrow();expect(()=>choose(s,data.items[0].id,'bad')).toThrow();
 expect(initialState()).toEqual(s);
});
it('四题完成后回顾，不生成分数且重置清空',()=>{
 let s=initialState();for(const i of data.items)s=choose(s,i.id,i.options[0].id);
 expect(complete(s)).toBe(true);expect(Object.keys(s)).toEqual(['answers']);
 expect(reset()).toEqual({answers:{}});expect(Object.keys(s.answers)).toHaveLength(4);
});
