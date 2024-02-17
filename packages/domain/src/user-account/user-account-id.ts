import { ulid } from "ulidx";
import { AggregateId } from "event-store-adapter-js";

const USER_ACCOUNT_PREFIX: string = "UserAccount";
const UserAccountIdSymbol = Symbol("UserAccountId");

class UserAccountId implements AggregateId {
  readonly symbol: typeof UserAccountIdSymbol = UserAccountIdSymbol;

  private readonly _value: string;

  private constructor(value?: string) {
    if (value === undefined) {
      this._value = ulid();
    } else {
      if (value.startsWith(USER_ACCOUNT_PREFIX + "-")) {
        value = value.substring(USER_ACCOUNT_PREFIX.length + 1);
      }
      this._value = value;
    }
  }

  static of(value: string): UserAccountId {
    return new UserAccountId(value);
  }

  static newId(): UserAccountId {
    return new UserAccountId();
  }

  get asString(): string {
    return `${this.typeName}-${this._value}`;
  }

  get value(): string {
    return this._value;
  }

  get typeName(): string {
    return USER_ACCOUNT_PREFIX;
  }
}

export { UserAccountId };
