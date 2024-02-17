const GroupChatAddMemberErrorSymbol = Symbol("GroupChatAddMemberError");

class GroupChatAddMemberError {
  readonly symbol: typeof GroupChatAddMemberErrorSymbol =
    GroupChatAddMemberErrorSymbol;
  private constructor(public readonly message: string) {}
  static of(message: string): GroupChatAddMemberError {
    return new GroupChatAddMemberError(message);
  }
}

const GroupChatRemoveMemberErrorSymbol = Symbol("GroupChatMemberRemoveError");
class GroupChatRemoveMemberError {
  readonly symbol: typeof GroupChatRemoveMemberErrorSymbol =
    GroupChatRemoveMemberErrorSymbol;
  private constructor(public readonly message: string) {}
  static of(message: string): GroupChatRemoveMemberError {
    return new GroupChatRemoveMemberError(message);
  }
}

const GroupChatDeleteErrorSymbol = Symbol("GroupChatDeleteError");

class GroupChatDeleteError {
  readonly symbol: typeof GroupChatDeleteErrorSymbol =
    GroupChatDeleteErrorSymbol;
  private constructor(public readonly message: string) {}
  static of(message: string): GroupChatDeleteError {
    return new GroupChatDeleteError(message);
  }
}

type GroupChatError = GroupChatDeleteError | GroupChatAddMemberError;

export {
  GroupChatError,
  GroupChatAddMemberError,
  GroupChatRemoveMemberError,
  GroupChatDeleteError,
};
