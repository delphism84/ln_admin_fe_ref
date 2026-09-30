/**
 * 어디서나 부를 수 있는 확인/알림/입력 대화상자(games_card 통합어드민의 dialog 패턴).
 *   if (await dialog.confirm('삭제할까요?', { danger: true })) …
 *   const reason = await dialog.prompt('정지 사유');
 * 실제 화면은 components/ui/DialogHost.tsx 가 그린다.
 */
export type DialogRequest = {
  id: number;
  kind: 'alert' | 'confirm' | 'prompt';
  title?: string;
  message: string;
  danger?: boolean;
  okText?: string;
  cancelText?: string;
  /** prompt: 입력란 설명·초기값·여러 줄 여부 */
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  /** prompt: 이 문자열을 그대로 입력해야 확인 버튼이 켜진다(위험 작업 확인용) */
  requireText?: string;
  resolve: (v: any) => void;
};

type Listener = (queue: DialogRequest[]) => void;

let seq = 0;
let queue: DialogRequest[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(queue));
}

export function subscribeDialogs(l: Listener) {
  listeners.add(l);
  l(queue);
  return () => {
    listeners.delete(l);
  };
}

export function settleDialog(id: number, value: any) {
  const req = queue.find((q) => q.id === id);
  queue = queue.filter((q) => q.id !== id);
  emit();
  req?.resolve(value);
}

type Opts = Partial<Omit<DialogRequest, 'id' | 'kind' | 'message' | 'resolve'>>;

function push<T>(kind: DialogRequest['kind'], message: string, opts: Opts = {}): Promise<T> {
  return new Promise<T>((resolve) => {
    seq += 1;
    queue = [...queue, { id: seq, kind, message, resolve, ...opts }];
    emit();
  });
}

export const dialog = {
  alert: (message: string, opts?: Opts) => push<void>('alert', message, opts),
  confirm: (message: string, opts?: Opts) => push<boolean>('confirm', message, opts),
  /** 취소하면 null */
  prompt: (message: string, opts?: Opts) => push<string | null>('prompt', message, opts),
};
