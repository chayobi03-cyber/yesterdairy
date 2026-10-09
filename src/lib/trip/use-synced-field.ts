"use client";

import { useState } from "react";

// 서버 값과 동기화되는 입력칸. 사용자가 입력 중이면(저장된 값과 다르면) 서버가 새 값을 보내도
// 덮어쓰지 않고, 입력 중이 아니면 가족이 바꾼 값을 그대로 따라간다.
export function useSyncedField(serverValue: string) {
  const [value, setValue] = useState(serverValue);
  const [saved, setSaved] = useState(serverValue);
  const [seen, setSeen] = useState(serverValue);

  if (seen !== serverValue) {
    setSeen(serverValue);
    if (value === saved) setValue(serverValue);
    setSaved(serverValue);
  }

  return {
    value,
    setValue,
    dirty: value !== saved,
    // 저장을 시작할 때 호출: 저장된 값으로 기록하고 그 값을 돌려준다
    commit: () => {
      setSaved(value);
      return value;
    },
  };
}
