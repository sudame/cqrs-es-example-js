import { describe } from "node:test";
import { GroupChatRepository } from "./group-chat-repository";
import {
  GroupChatId,
  GroupChat,
  GroupChatName,
  UserAccountId,
  GroupChatEvent,
  convertJSONToGroupChat,
  convertJSONToGroupChatEvent,
} from "cqrs-es-example-js-domain";
import {
  GenericContainer,
  StartedTestContainer,
  TestContainer,
  Wait,
} from "testcontainers";
import { EventStoreForDynamoDB } from "event-store-adapter-js/dist/internal/event-store-for-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  createDynamoDBClient,
  createJournalTable,
  createSnapshotTable,
} from "../test/dynamodb-utils";
import {
  Event,
  Aggregate,
  AggregateId,
  EventSerializer,
  KeyResolver,
  SnapshotSerializer,
} from "event-store-adapter-js";

afterEach(() => {
  jest.useRealTimers();
});

describe("GroupChatRepository", () => {
  const TEST_TIME_FACTOR = parseFloat(process.env.TEST_TIME_FACTOR ?? "1.0");
  const TIMEOUT: number = 10 * 1000 * TEST_TIME_FACTOR;

  let container: TestContainer;
  let startedContainer: StartedTestContainer;
  let eventStore: EventStoreForDynamoDB<GroupChatId, GroupChat, GroupChatEvent>;

  const JOURNAL_TABLE_NAME = "journal";
  const SNAPSHOT_TABLE_NAME = "snapshot";
  const JOURNAL_AID_INDEX_NAME = "journal-aid-index";
  const SNAPSHOTS_AID_INDEX_NAME = "snapshots-aid-index";

  function createEventStore(
    dynamodbClient: DynamoDBClient,
  ): EventStoreForDynamoDB<GroupChatId, GroupChat, GroupChatEvent> {
    return new EventStoreForDynamoDB<GroupChatId, GroupChat, GroupChatEvent>(
      dynamodbClient,
      JOURNAL_TABLE_NAME,
      SNAPSHOT_TABLE_NAME,
      JOURNAL_AID_INDEX_NAME,
      SNAPSHOTS_AID_INDEX_NAME,
      32,
      convertJSONToGroupChatEvent,
      convertJSONToGroupChat,
      undefined,
      undefined,
      new CustomKeyResolver(),
      new CustomJsonEventSerializer<GroupChatId, GroupChatEvent>(),
      new CustomJsonSnapshotSerializer<GroupChatId, GroupChat>(),
    );
  }

  beforeAll(async () => {
    container = new GenericContainer("localstack/localstack:2.1.0")
      .withEnvironment({
        SERVICES: "dynamodb",
        DEFAULT_REGION: "us-west-1",
        EAGER_SERVICE_LOADING: "1",
        DYNAMODB_SHARED_DB: "1",
        DYNAMODB_IN_MEMORY: "1",
      })
      .withWaitStrategy(Wait.forLogMessage("Ready."))
      .withExposedPorts(4566);
    startedContainer = await container.start();
    const dynamodbClient = createDynamoDBClient(startedContainer);
    await createJournalTable(
      dynamodbClient,
      JOURNAL_TABLE_NAME,
      JOURNAL_AID_INDEX_NAME,
    );
    await createSnapshotTable(
      dynamodbClient,
      SNAPSHOT_TABLE_NAME,
      SNAPSHOTS_AID_INDEX_NAME,
    );
    eventStore = createEventStore(dynamodbClient);
  }, TIMEOUT);

  afterAll(async () => {
    if (startedContainer !== undefined) {
      await startedContainer.stop();
    }
  }, TIMEOUT);

  test("store and reply", async () => {
    // const eventStore: EventStore<GroupChatId, GroupChat, GroupChatEvent> =
    //   EventStoreFactory.ofMemory<GroupChatId, GroupChat, GroupChatEvent>();
    const repository = GroupChatRepository.of(eventStore);

    const id = GroupChatId.generate();
    const name = GroupChatName.of("name");
    const adminId = UserAccountId.generate();
    const [groupChat1, groupChatCreated] = GroupChat.create(id, name, adminId);

    await repository.storeEventAndSnapshot(groupChatCreated, groupChat1);

    const groupChat2 = await repository.findById(id);
    if (groupChat2 === undefined) {
      throw new Error("groupChat2 is undefined");
    }

    expect(groupChat2.id.equals(id)).toEqual(true);
  });
});

class CustomJsonEventSerializer<AID extends AggregateId, E extends Event<AID>>
  implements EventSerializer<AID, E>
{
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  deserialize(bytes: Uint8Array, converter: (json: string) => E): E {
    const jsonString = this.decoder.decode(bytes);
    return converter(jsonString);
  }

  serialize(event: E): Uint8Array {
    const jsonString = JSON.stringify({
      type: event.typeName,
      data: event,
    });
    return this.encoder.encode(jsonString);
  }
}

class CustomJsonSnapshotSerializer<
  AID extends AggregateId,
  A extends Aggregate<A, AID>,
> implements SnapshotSerializer<AID, A>
{
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  deserialize(bytes: Uint8Array, converter: (json: string) => A): A {
    const jsonString = this.decoder.decode(bytes);
    return converter(jsonString);
  }

  serialize(aggregate: A): Uint8Array {
    const jsonString = JSON.stringify({
      type: aggregate.typeName,
      data: aggregate,
    });
    return this.encoder.encode(jsonString);
  }
}
class CustomKeyResolver<AID extends AggregateId> implements KeyResolver<AID> {
  private hashString(str: string): number {
    if (str === undefined || str === null) {
      throw new Error(`str is undefined or null: ${str}`);
    }
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash >>> 0; // Convert to unsigned 32bit integer
  }

  resolvePartitionKey(aggregateId: AID, shardCount: number): string {
    if (aggregateId === undefined || aggregateId === null) {
      throw new Error(`aggregateId is undefined or null: ${aggregateId}`);
    }
    const hash = this.hashString(aggregateId.asString);
    const remainder = hash % shardCount;
    return `${aggregateId.typeName}-${remainder}`;
  }

  resolveSortKey(aggregateId: AID, sequenceNumber: number): string {
    return `${aggregateId.typeName}-${aggregateId.value}-${sequenceNumber}`;
  }
}
