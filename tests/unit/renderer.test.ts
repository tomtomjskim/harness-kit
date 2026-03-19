import { describe, it, expect } from 'vitest';
import { render } from '../../src/pipeline/renderer.js';
import { UndefinedVariableError } from '../../src/errors.js';

describe('render', () => {
  it('기본 변수 치환: {{name}} → 값', () => {
    const result = render('Hello, {{name}}!', { name: 'World' });
    expect(result).toBe('Hello, World!');
  });

  it('default 변수 적용: required=false, default="256m" → "256m"', () => {
    const variableDefs = {
      memLimit: { type: 'string' as const, required: false, default: '256m' },
    };
    const result = render('Limit: {{memLimit}}', {}, variableDefs, 'test-module');
    expect(result).toBe('Limit: 256m');
  });

  it('required 변수 미정의 → UndefinedVariableError throw', () => {
    const variableDefs = {
      requiredVar: { type: 'string' as const, required: true },
    };
    expect(() => render('Value: {{requiredVar}}', {}, variableDefs, 'test-module')).toThrow(
      UndefinedVariableError,
    );
  });

  it('optional 변수 미정의 → 빈 문자열 (에러 없음)', () => {
    // No variableDefs, no vars — Mustache renders empty string for unknown vars
    const result = render('Value: {{optionalVar}}', {});
    expect(result).toBe('Value: ');
  });

  it('{{#section}}...{{/section}} 조건부 블록: 값 있으면 출력', () => {
    const template = '{{#showSection}}visible content{{/showSection}}';
    const result = render(template, { showSection: true });
    expect(result).toContain('visible content');
  });

  it('{{#section}}...{{/section}} 조건부 블록: 값 없으면 미출력', () => {
    const template = '{{#showSection}}visible content{{/showSection}}';
    const result = render(template, { showSection: false });
    expect(result).not.toContain('visible content');
    expect(result).toBe('');
  });

  it('HTML 이스케이프 비활성화: <div> → 그대로 출력', () => {
    const result = render('Tag: {{htmlContent}}', { htmlContent: '<div>hello</div>' });
    expect(result).toBe('Tag: <div>hello</div>');
    expect(result).not.toContain('&lt;');
    expect(result).not.toContain('&gt;');
  });

  it('vars와 default 동시 적용 시 vars가 우선', () => {
    const variableDefs = {
      memLimit: { type: 'string' as const, required: false, default: '256m' },
    };
    const result = render('Limit: {{memLimit}}', { memLimit: '1024m' }, variableDefs, 'test-module');
    expect(result).toBe('Limit: 1024m');
  });

  it('moduleName이 에러 메시지에 포함됨', () => {
    const variableDefs = {
      myVar: { type: 'string' as const, required: true },
    };
    try {
      render('{{myVar}}', {}, variableDefs, 'my-special-module');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UndefinedVariableError);
      expect((err as UndefinedVariableError).message).toContain('my-special-module');
    }
  });
});
