import { Arg, Ctx, Mutation, Query, Resolver } from "type-graphql";
import {
  AddMemberInput,
  CreateGroupChatInput,
  DeleteGroupChatInput,
  DeleteMessageInput,
  PostMessageInput,
  RemoveMemberInput,
  RenameGroupChatInput,
} from "./inputs";
import { GroupChatCommandProcessor } from "cqrs-es-example-js-command-use-case";
import {
  GroupChatId,
  GroupChatName,
  MemberRole,
  Message,
  MessageId,
  UserAccountId,
} from "cqrs-es-example-js-command-domain";
import * as TE from "fp-ts/TaskEither";
import { GroupChatOutput, HealthCheckOutput, MessageOutput } from "./outputs";
import { GraphQLError } from "graphql/error";
import { pipe } from "fp-ts/function";
import { ProcessError } from "cqrs-es-example-js-command-use-case";
import { RepositoryError } from "cqrs-es-example-js-command-interface-adaptor-if";
import { OptimisticLockError } from "event-store-adapter-js";
import { TaskEither } from "fp-ts/TaskEither";
import { Task } from "fp-ts/Task";

class ValidationGraphQLError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: "400",
      },
    });
  }
}

class OptimisticLockingGraphQLError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: "409",
      },
    });
  }
}

class InternalServerGraphQLError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: "500",
      },
    });
  }
}

interface CommandContext {
  groupChatCommandProcessor: GroupChatCommandProcessor;
}

@Resolver(() => GroupChatOutput)
class GroupChatCommandResolver {
  @Query(() => HealthCheckOutput)
  async healthCheck(): Promise<HealthCheckOutput> {
    return { value: "OK" };
  }
  private convertToError(error: string | ProcessError): Error {
    if (typeof error === "string") {
      return new ValidationGraphQLError(error);
    } else {
      if (
        error.cause instanceof RepositoryError &&
        error.cause.cause instanceof OptimisticLockError
      ) {
        return new OptimisticLockingGraphQLError(error.message);
      }
      return new InternalServerGraphQLError(error.message);
    }
  }

  private toTask<A, B>(): (_: TaskEither<A, B>) => Task<B> {
    return TE.fold<A, B, B>(
      (e) => () => Promise.reject(e),
      (r) => () => Promise.resolve(r),
    );
  }

  @Mutation(() => GroupChatOutput)
  async createGroupChat(
    @Ctx() { groupChatCommandProcessor }: CommandContext,
    @Arg("input") input: CreateGroupChatInput,
  ): Promise<GroupChatOutput> {
    return pipe(
      GroupChatName.validate(input.name),
      TE.fromEither,
      TE.chainW((validatedName) =>
        pipe(
          UserAccountId.validate(input.executorId),
          TE.fromEither,
          TE.map((validatedExecutorId) => ({
            validatedName,
            validatedExecutorId,
          })),
        ),
      ),
      TE.chainW(({ validatedName, validatedExecutorId }) =>
        groupChatCommandProcessor.createGroupChat(
          validatedName,
          validatedExecutorId,
        ),
      ),
      TE.map((groupChatEvent) => ({
        groupChatId: groupChatEvent.aggregateId.asString(),
      })),
      TE.mapLeft(this.convertToError),
      this.toTask(),
    )();
  }

  @Mutation(() => GroupChatOutput)
  async deleteGroupChat(
    @Ctx() { groupChatCommandProcessor }: CommandContext,
    @Arg("input") input: DeleteGroupChatInput,
  ): Promise<GroupChatOutput> {
    return pipe(
      GroupChatId.validate(input.groupChatId),
      TE.fromEither,
      TE.chainW((validateGroupChatId) =>
        pipe(
          TE.fromEither(UserAccountId.validate(input.executorId)),
          TE.map((validatedExecutorId) => ({
            validateGroupChatId,
            validatedExecutorId,
          })),
        ),
      ),
      TE.chainW(({ validateGroupChatId, validatedExecutorId }) =>
        groupChatCommandProcessor.deleteGroupChat(
          validateGroupChatId,
          validatedExecutorId,
        ),
      ),
      TE.map((groupChatEvent) => ({
        groupChatId: groupChatEvent.aggregateId.asString(),
      })),
      TE.mapLeft(this.convertToError),
      this.toTask(),
    )();
  }

  @Mutation(() => GroupChatOutput)
  async renameGroupChat(
    @Ctx() { groupChatCommandProcessor }: CommandContext,
    @Arg("input") input: RenameGroupChatInput,
  ): Promise<GroupChatOutput> {
    return pipe(
      GroupChatId.validate(input.groupChatId),
      TE.fromEither,
      TE.chainW((validateGroupChatId) =>
        pipe(
          GroupChatName.validate(input.name),
          TE.fromEither,
          TE.map((validatedGroupChatName) => ({
            validateGroupChatId,
            validatedGroupChatName,
          })),
        ),
      ),
      TE.chainW(({ validateGroupChatId, validatedGroupChatName }) =>
        pipe(
          UserAccountId.validate(input.executorId),
          TE.fromEither,
          TE.map((validatedExecutorId) => ({
            validateGroupChatId,
            validatedGroupChatName,
            validatedExecutorId,
          })),
        ),
      ),
      TE.chainW(
        ({
          validateGroupChatId,
          validatedGroupChatName,
          validatedExecutorId,
        }) =>
          groupChatCommandProcessor.renameGroupChat(
            validateGroupChatId,
            validatedGroupChatName,
            validatedExecutorId,
          ),
      ),
      TE.map((groupChatEvent) => ({
        groupChatId: groupChatEvent.aggregateId.asString(),
      })),
      TE.mapLeft(this.convertToError),
      this.toTask(),
    )();
  }

  @Mutation(() => GroupChatOutput)
  async addMember(
    @Ctx() { groupChatCommandProcessor }: CommandContext,
    @Arg("input") input: AddMemberInput,
  ): Promise<GroupChatOutput> {
    return pipe(
      GroupChatId.validate(input.groupChatId),
      TE.fromEither,
      TE.chainW((validateGroupChatId) =>
        pipe(
          UserAccountId.validate(input.userAccountId),
          TE.fromEither,
          TE.map((validatedUserAccountId) => ({
            validateGroupChatId,
            validatedUserAccountId,
          })),
        ),
      ),
      TE.chainW(({ validateGroupChatId, validatedUserAccountId }) =>
        pipe(
          TE.right(input.role.toLowerCase() as MemberRole),
          TE.map((validatedRole) => ({
            validateGroupChatId,
            validatedUserAccountId,
            validatedRole,
          })),
        ),
      ),
      TE.chainW(
        ({ validateGroupChatId, validatedUserAccountId, validatedRole }) =>
          pipe(
            UserAccountId.validate(input.executorId),
            TE.fromEither,
            TE.map((validatedExecutorId) => ({
              validateGroupChatId,
              validatedUserAccountId,
              validatedRole,
              validatedExecutorId,
            })),
          ),
      ),
      TE.chainW(
        ({
          validateGroupChatId,
          validatedUserAccountId,
          validatedRole,
          validatedExecutorId,
        }) =>
          groupChatCommandProcessor.addMemberToGroupChat(
            validateGroupChatId,
            validatedUserAccountId,
            validatedRole,
            validatedExecutorId,
          ),
      ),
      TE.map((groupChatEvent) => ({
        groupChatId: groupChatEvent.aggregateId.asString(),
      })),
      TE.mapLeft(this.convertToError),
      this.toTask(),
    )();
  }

  @Mutation(() => GroupChatOutput)
  async removeMember(
    @Ctx() { groupChatCommandProcessor }: CommandContext,
    @Arg("input") input: RemoveMemberInput,
  ): Promise<GroupChatOutput> {
    return pipe(
      GroupChatId.validate(input.groupChatId),
      TE.fromEither,
      TE.chainW((validateGroupChatId) =>
        pipe(
          UserAccountId.validate(input.userAccountId),
          TE.fromEither,
          TE.map((validatedUserAccountId) => ({
            validateGroupChatId,
            validatedUserAccountId,
          })),
        ),
      ),
      TE.chainW(({ validateGroupChatId, validatedUserAccountId }) =>
        pipe(
          UserAccountId.validate(input.executorId),
          TE.fromEither,
          TE.map((validatedExecutorId) => ({
            validateGroupChatId,
            validatedUserAccountId,
            validatedExecutorId,
          })),
        ),
      ),
      TE.chainW(
        ({
          validateGroupChatId,
          validatedUserAccountId,
          validatedExecutorId,
        }) =>
          groupChatCommandProcessor.removeMemberFromGroupChat(
            validateGroupChatId,
            validatedUserAccountId,
            validatedExecutorId,
          ),
      ),
      TE.map((groupChatEvent) => ({
        groupChatId: groupChatEvent.aggregateId.asString(),
      })),
      TE.mapLeft(this.convertToError),
      this.toTask(),
    )();
  }

  @Mutation(() => MessageOutput)
  async postMessage(
    @Ctx() { groupChatCommandProcessor }: CommandContext,
    @Arg("input") input: PostMessageInput,
  ): Promise<MessageOutput> {
    return pipe(
      GroupChatId.validate(input.groupChatId),
      TE.fromEither,
      TE.chainW((validateGroupChatId) =>
        pipe(
          UserAccountId.validate(input.executorId),
          TE.fromEither,
          TE.map((validatedExecutorId) => ({
            validateGroupChatId,
            validatedExecutorId,
          })),
        ),
      ),
      TE.chainW(({ validateGroupChatId, validatedExecutorId }) =>
        pipe(
          Message.validate(
            MessageId.generate(),
            input.content,
            validatedExecutorId,
            new Date(),
          ),
          TE.fromEither,
          TE.map((validatedMessage) => ({
            validateGroupChatId,
            validatedExecutorId,
            validatedMessage,
          })),
        ),
      ),
      TE.chainW(
        ({ validateGroupChatId, validatedExecutorId, validatedMessage }) =>
          pipe(
            groupChatCommandProcessor.postMessageToGroupChat(
              validateGroupChatId,
              validatedMessage,
              validatedExecutorId,
            ),
            TE.map((groupChatEvent) => ({
              groupChatId: groupChatEvent.aggregateId.asString(),
              messageId: validatedMessage.id.asString(),
            })),
          ),
      ),
      TE.mapLeft(this.convertToError),
      this.toTask(),
    )();
  }

  @Mutation(() => GroupChatOutput)
  async deleteMessage(
    @Ctx() { groupChatCommandProcessor }: CommandContext,
    @Arg("input") input: DeleteMessageInput,
  ): Promise<GroupChatOutput> {
    return pipe(
      GroupChatId.validate(input.groupChatId),
      TE.fromEither,
      TE.chainW((validateGroupChatId) =>
        pipe(
          MessageId.validate(input.messageId),
          TE.fromEither,
          TE.map((validatedMessageId) => ({
            validateGroupChatId,
            validatedMessageId,
          })),
        ),
      ),
      TE.chainW(({ validateGroupChatId, validatedMessageId }) =>
        pipe(
          UserAccountId.validate(input.executorId),
          TE.fromEither,
          TE.map((validatedExecutorId) => ({
            validateGroupChatId,
            validatedMessageId,
            validatedExecutorId,
          })),
        ),
      ),
      TE.chainW(
        ({ validateGroupChatId, validatedMessageId, validatedExecutorId }) =>
          groupChatCommandProcessor.deleteMessageFromGroupChat(
            validateGroupChatId,
            validatedMessageId,
            validatedExecutorId,
          ),
      ),
      TE.map((groupChatEvent) => ({
        groupChatId: groupChatEvent.aggregateId.asString(),
      })),
      TE.mapLeft(this.convertToError),
      this.toTask(),
    )();
  }
}

export {
  CommandContext,
  GroupChatCommandResolver,
  ValidationGraphQLError,
  OptimisticLockingGraphQLError,
  InternalServerGraphQLError,
};
