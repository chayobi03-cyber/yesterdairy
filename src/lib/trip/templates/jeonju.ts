import type { TripDef } from "../types";

// 전주 가족 1박 2일 기본 템플릿. 좌표(approx)는 근사치이고 운영시간·행사·주차는
// 실시간 검증값이 아니므로 방문 전 공식 채널에서 확인해야 한다.
// 시간·요금 정보의 근거와 한계는 docs/jeonju-template-research.md 참고.
// 항목의 at(고정 시작 시각)은 체크인·저녁처럼 시각이 정해진 항목에 쓴다.
export const jeonjuTemplate: TripDef = {
  "id": "jeonju-2d",
  "title": "전주 가족 1박 2일",
  "dest": "전주",
  "party": "성인 2 · 초등 1",
  "center": [
    35.8135,
    127.15
  ],
  "days": [
    {
      "n": 1,
      "label": "1일차",
      "start": "11:30"
    },
    {
      "n": 2,
      "label": "2일차",
      "start": "09:30"
    }
  ],
  "mandatory": [
    "jeondong",
    "gyeonggijeon",
    "hyanggyo"
  ],
  "defaultPlan": "balanced",
  "places": [
    {
      "id": "parking",
      "name": "한옥마을 인근 주차",
      "cat": "parking",
      "lat": 35.8143,
      "lon": 127.1531,
      "approx": true,
      "dur": 20,
      "desc": "주차 후 도보로 이동하는 출발점.",
      "hours": "한옥마을 공영주차장: 최초 30분 1,200원 + 15분마다 600원, 1일권 14,400원 (2025.9 보도 기준, 변동 가능)",
      "tips": [
        "주말·행사일에는 만차가 잦을 수 있어 대체 주차장을 미리 정해 두세요.",
        "제4공영주차장은 무료이고 셔틀버스로 연결돼요 (셔틀 운행시간은 비공식 자료라 출발 전 확인)."
      ],
      "checks": [
        "주차장 운영시간/요금 확인",
        "대체 주차장 1곳 저장"
      ]
    },
    {
      "id": "lunch",
      "name": "전주비빔밥 점심",
      "cat": "food",
      "lat": 35.8128,
      "lon": 127.149,
      "approx": true,
      "dur": 70,
      "desc": "전주 대표 메뉴. 대기시간이 길 수 있습니다.",
      "food": [
        "전주비빔밥",
        "콩나물국밥",
        "한정식(예약형)"
      ],
      "checks": [
        "영업시간·브레이크타임 확인",
        "대기/예약 여부 확인",
        "아이 메뉴(안 맵게) 확인"
      ]
    },
    {
      "id": "jeondong",
      "name": "전동성당",
      "cat": "sight",
      "lat": 35.8133,
      "lon": 127.1497,
      "dur": 35,
      "desc": "호남 최초의 서양식 성당. 한옥마을 입구의 대표 포토 스폿.",
      "hours": "내부 관람 09:00~17:00, 무료 (2026 여행 매체 보도 기준 · 미사 시각은 확인하지 못함)",
      "tips": [
        "미사 시간에는 내부 관람이 제한될 수 있어요.",
        "조용히 관람하도록 아이와 미리 이야기해 두세요."
      ],
      "checks": [
        "내부 관람 가능 시간 확인",
        "복장·소음 예절 안내"
      ]
    },
    {
      "id": "gyeonggijeon",
      "name": "경기전",
      "cat": "sight",
      "lat": 35.8152,
      "lon": 127.15,
      "dur": 60,
      "desc": "태조 어진을 모신 곳. 조선왕조실록 이야기를 아이와 함께.",
      "hours": "9월 기준 09:00~19:00 (입장 18:00 마감, 계절별 상이) · 성인 3,000원",
      "tips": [
        "2026.3.26~12.17 정전 단청공사 예정으로 정전 구역은 출입이 제한돼요 (경내·어진박물관은 관람 가능, 종료일은 바뀔 수 있음).",
        "어진박물관 휴관일은 자료마다 달라요. 한복 입장료 혜택도 확인하지 못했으니 현장 안내를 확인하세요."
      ],
      "checks": [
        "입장료/운영시간 확인",
        "해설 프로그램 여부 확인"
      ]
    },
    {
      "id": "snack",
      "name": "초코파이·길거리 간식",
      "cat": "food",
      "lat": 35.8131,
      "lon": 127.1502,
      "approx": true,
      "dur": 30,
      "desc": "전동성당 인근 간식 골목.",
      "food": [
        "초코파이",
        "꼬치",
        "아이스크림"
      ],
      "checks": [
        "영업시간 확인"
      ]
    },
    {
      "id": "hanok-walk",
      "name": "한옥마을 골목 산책",
      "cat": "sight",
      "lat": 35.8146,
      "lon": 127.1522,
      "approx": true,
      "dur": 50,
      "desc": "느린 걸음으로 골목과 전통 공방 구경."
    },
    {
      "id": "hanok-exp",
      "name": "한옥마을 체험 (한복/공예)",
      "cat": "activity",
      "lat": 35.8148,
      "lon": 127.1517,
      "approx": true,
      "dur": 70,
      "opt": true,
      "desc": "한복 대여 또는 전통 공예 체험. 예약·접수 가능 여부를 먼저 확인하세요.",
      "checks": [
        "체험 예약·접수 가능 여부",
        "아이 연령/체험 시간 제한",
        "요금 확인"
      ]
    },
    {
      "id": "dinner",
      "name": "저녁 식사",
      "cat": "food",
      "lat": 35.812,
      "lon": 127.147,
      "approx": true,
      "dur": 80,
      "desc": "한정식/막걸리 골목은 예약이 필요할 수 있어요.",
      "food": [
        "한정식",
        "전주 막걸리 골목(보호자)",
        "돈가스·칼국수(아이 선택)"
      ],
      "checks": [
        "예약 여부",
        "영업 마감 시간"
      ]
    },
    {
      "id": "nanjang",
      "name": "전주예술난장 (거리공연 축제)",
      "cat": "show",
      "dur": 60,
      "opt": true,
      "desc": "연 1회 열리는 거리예술 축제예요. 2025년에는 팔복동 일대에서 열렸고, 한옥마을 상설 공연이 아니라서 위치(좌표)를 넣지 않았어요.",
      "hours": "개최 여부·일정·장소 확인 필수 (2026년 개최 계획은 확인하지 못함)",
      "tips": [
        "열리는 해와 장소는 전주문화재단 공지로 확인하고, 열린다면 좌표를 직접 입력해 쓰세요."
      ],
      "checks": [
        "개최 일정/장소 공식 확인",
        "공연 시작 시간 확인"
      ]
    },
    {
      "id": "stay",
      "name": "숙소 체크인",
      "cat": "stay",
      "dur": 40,
      "desc": "체크인 후 휴식. 체크인은 보통 오후 3시 이후라 그 전에는 짐만 맡길 수 있어요. 숙소 위치를 알면 내 장소로 좌표를 넣어 쓰세요.",
      "checks": [
        "체크인 가능 시간",
        "주차 가능 여부"
      ]
    },
    {
      "id": "hyanggyo",
      "name": "전주향교",
      "cat": "sight",
      "lat": 35.8108,
      "lon": 127.1566,
      "approx": true,
      "dur": 50,
      "desc": "고즈넉한 향교와 오래된 은행나무. 한적한 아침 산책에 좋아요.",
      "hours": "입장 무료로 소개됨 (개방시간·주차는 확인하지 못함)",
      "tips": [
        "대성전 앞 400년 넘은 은행나무는 11월 초중순에 노랗게 물들어요 (10월 초에는 이를 수 있어요)."
      ],
      "checks": [
        "개방시간 확인",
        "주변 주차 확인"
      ]
    },
    {
      "id": "omokdae",
      "name": "오목대·이목대 전망",
      "cat": "sight",
      "lat": 35.813,
      "lon": 127.159,
      "approx": true,
      "dur": 35,
      "desc": "한옥마을 지붕 풍경을 내려다보는 전망 포인트."
    },
    {
      "id": "mural",
      "name": "자만벽화마을",
      "cat": "sight",
      "lat": 35.8122,
      "lon": 127.1611,
      "approx": true,
      "dur": 45,
      "opt": true,
      "desc": "아이와 사진 찍기 좋은 벽화 골목(만화 캐릭터 위주, 30분~1시간). 입구와 중간에 오르막이 있고 마을 안에는 주차가 어려워요. 유모차는 불편할 수 있어요.",
      "hours": "상시 개방으로 소개됨 (마을 안 주차 불가 — 한옥마을 쪽에 주차 후 도보)"
    },
    {
      "id": "cafe",
      "name": "한옥 카페 휴식",
      "cat": "food",
      "lat": 35.8139,
      "lon": 127.1527,
      "approx": true,
      "dur": 50,
      "desc": "아이 간식과 함께하는 여유 시간.",
      "checks": [
        "영업시간 확인"
      ]
    },
    {
      "id": "market",
      "name": "남부시장 점심",
      "cat": "food",
      "lat": 35.8118,
      "lon": 127.1428,
      "approx": true,
      "dur": 70,
      "desc": "시장 먹거리 점심. 이동 후 주차 계획이 필요합니다.",
      "hours": "점포별 영업시간·휴무일이 달라요 (대략 09:30~23:00로 소개됨). 야시장은 금·토에만 열려요.",
      "food": [
        "국밥",
        "시장 분식",
        "전통 간식"
      ],
      "checks": [
        "휴무일·영업시간 확인",
        "주차 계획"
      ]
    },
    {
      "id": "fin",
      "name": "귀가 준비·출발",
      "cat": "etc",
      "dur": 30,
      "desc": "짐 정리, 주유/휴게소 계획."
    }
  ],
  "plans": {
    "balanced": {
      "label": "균형형",
      "desc": "대표 관광과 여유를 함께 고려한 기본 일정",
      "days": {
        "1": [
          {
            "id": "d1-parking",
            "p": "parking"
          },
          {
            "id": "d1-lunch",
            "p": "lunch"
          },
          {
            "id": "d1-jeondong",
            "p": "jeondong"
          },
          {
            "id": "d1-gyeonggijeon",
            "p": "gyeonggijeon"
          },
          {
            "id": "d1-snack",
            "p": "snack"
          },
          {
            "id": "d1-stay",
            "p": "stay"
          },
          {
            "id": "d1-hanok-walk",
            "p": "hanok-walk"
          },
          {
            "id": "d1-dinner",
            "p": "dinner",
            "at": "17:30"
          }
        ],
        "2": [
          {
            "id": "d2-hyanggyo",
            "p": "hyanggyo"
          },
          {
            "id": "d2-omokdae",
            "p": "omokdae"
          },
          {
            "id": "d2-mural",
            "p": "mural",
            "included": false
          },
          {
            "id": "d2-market",
            "p": "market",
            "at": "11:30"
          },
          {
            "id": "d2-fin",
            "p": "fin"
          }
        ]
      }
    },
    "experience": {
      "label": "체험형",
      "desc": "체험·공연 항목을 더 넣은 일정 (예약·접수 확인 필수)",
      "days": {
        "1": [
          {
            "id": "d1-parking",
            "p": "parking"
          },
          {
            "id": "d1-lunch",
            "p": "lunch"
          },
          {
            "id": "d1-jeondong",
            "p": "jeondong"
          },
          {
            "id": "d1-gyeonggijeon",
            "p": "gyeonggijeon"
          },
          {
            "id": "d1-snack",
            "p": "snack"
          },
          {
            "id": "d1-hanok-exp",
            "p": "hanok-exp"
          },
          {
            "id": "d1-stay",
            "p": "stay"
          },
          {
            "id": "d1-dinner",
            "p": "dinner",
            "at": "17:30"
          }
        ],
        "2": [
          {
            "id": "d2-hyanggyo",
            "p": "hyanggyo"
          },
          {
            "id": "d2-omokdae",
            "p": "omokdae"
          },
          {
            "id": "d2-mural",
            "p": "mural"
          },
          {
            "id": "d2-market",
            "p": "market"
          },
          {
            "id": "d2-fin",
            "p": "fin"
          }
        ]
      }
    },
    "relaxed": {
      "label": "여유형",
      "desc": "선택 항목을 줄이고 휴식 시간을 확보한 일정",
      "days": {
        "1": [
          {
            "id": "d1-parking",
            "p": "parking"
          },
          {
            "id": "d1-lunch",
            "p": "lunch"
          },
          {
            "id": "d1-jeondong",
            "p": "jeondong"
          },
          {
            "id": "d1-gyeonggijeon",
            "p": "gyeonggijeon"
          },
          {
            "id": "d1-cafe",
            "p": "cafe"
          },
          {
            "id": "d1-stay",
            "p": "stay",
            "dur": 90
          },
          {
            "id": "d1-dinner",
            "p": "dinner",
            "at": "17:30"
          }
        ],
        "2": [
          {
            "id": "d2-hyanggyo",
            "p": "hyanggyo",
            "dur": 90
          },
          {
            "id": "d2-market",
            "p": "market",
            "at": "11:30"
          },
          {
            "id": "d2-fin",
            "p": "fin"
          }
        ]
      }
    }
  }
};
