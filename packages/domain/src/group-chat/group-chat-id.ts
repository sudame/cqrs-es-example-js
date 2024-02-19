import { ulid } from "ulidx";

const GROUP_CHAT_PREFIX: string = "GroupChat";
const GroupChatIdTypeSymbol = Symbol("GroupChatId");

interface GroupChatId {
  symbol: typeof GroupChatIdTypeSymbol;
  value: string;
  typeName: string;
  asString: string;
  equals: (anotherId: GroupChatId) => boolean;
}

function initialize(value?: string): GroupChatId {
  const _value: string = initializeValue(value);

  function initializeValue(value?: string): string {
    if (value === undefined) {
      return ulid();
    } else {
      return value.startsWith(GROUP_CHAT_PREFIX + "-")
        ? value.substring(GROUP_CHAT_PREFIX.length + 1)
        : value;
    }
  }

  return {
    symbol: GroupChatIdTypeSymbol,
    get value() {
      return _value;
    },
    get typeName() {
      return GROUP_CHAT_PREFIX;
    },
    get asString() {
      return `${GROUP_CHAT_PREFIX}-${_value}`;
    },
    equals(anotherId: GroupChatId): boolean {
      return _value === anotherId.value;
    },
  };
}

const GroupChatId = {
  of(value: string): GroupChatId {
    return initialize(value);
  },
  generate(): GroupChatId {
    return initialize();
  },
};

function convertJSONToGroupChatId(jsonString: string): GroupChatId {
  const obj = JSON.parse(jsonString);
  return GroupChatId.of(obj.value);
}

export { GroupChatId, GroupChatIdTypeSymbol, convertJSONToGroupChatId };
