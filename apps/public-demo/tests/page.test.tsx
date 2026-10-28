// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {it,expect} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import Demo from '../app/page';
it('真实页面可回放四阶段、完成四题、回顾并重置；不显示正式提交成功',()=>{
 render(<Demo/>);
 fireEvent.click(screen.getByRole('button',{name:'查看案例流程 →'}));
 expect(screen.getByText('案例开发流程回放')).toBeVisible();
 for(let i=0;i<3;i++)fireEvent.click(screen.getByRole('button',{name:'下一阶段 →'}));
 fireEvent.click(screen.getByRole('button',{name:'体验这组题目 →'}));
 expect(screen.getByRole('button',{name:'下一题 →'})).toBeDisabled();
 for(let i=0;i<4;i++){
  const group=screen.getByRole('group',{name:'行为选项'});
  fireEvent.click(group.querySelector('button')!);
  fireEvent.click(screen.getByRole('button',{name:i===3?'回顾选择':'下一题 →'}));
 }
 expect(screen.getByText('回顾你的选择')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'完成体验'}));
 expect(screen.getByText('体验完成')).toBeVisible();expect(screen.queryByText('提交成功')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'重新体验'}));
 expect(screen.getByText('已选择 0 / 4 题')).toBeVisible();
});
