/** 어디서나 부르는 알림: toast.success('저장했습니다') / toast.error(errorMessage(e)). 화면은 DialogHost 가 그린다. */
export type ToastItem = { id: number; kind: 'success' | 'error' | 'info'; message: string };

type Listener = (items: ToastItem[]) => void;

let seq = 0;
let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(items));
}

export function subscribeToasts(l: Listener) {
  listeners.add(l);
  l(items);
  return () => {
    listeners.delete(l);
  };
}

function push(kind: ToastItem['kind'], message: string, ms: number) {
  seq += 1;
  const id = seq;
  items = [...items, { id, kind, message }].slice(-4);
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, ms);
}

export const toast = {
  success: (m: string) => push('success', m, 2600),
  info: (m: string) => push('info', m, 3000),
  error: (m: string) => push('error', m, 5000),
};
