import { ApolloLink, Observable } from "@apollo/client";

import type {
  Operation,
  NextLink,
  FetchResult,
  RequestHandler,
} from "@apollo/client";

import type Echo from "laravel-echo";
import { Observer } from "@apollo/client";

import type { PresenceChannel, Channel } from "laravel-echo/dist/channel";
import { OperationDefinitionNode, FieldNode } from "graphql";

// The presence channel interface does not have the channel methods,
// but in reality the actual object does, so I try to fix this here.
type FixedEchoChannel = PresenceChannel & Channel;

function subscribeToEcho(
  echoClient: Echo,
  channelName: string,
  observer: Observer<FetchResult>
) {
  const channel = echoClient.private(channelName.replace(/^private\-/, '')) as FixedEchoChannel;

  channel.listen(".lighthouse-subscription", (result: { data: any }) =>
    observer.next(result.data?.data || result.data)
  );
}

function unsubscribe(echoClient: Echo, getChannelName: () => string) {
  const channelName = getChannelName();
  if (channelName) {
    echoClient.leave(channelName);
  }
}

function createSubscriptionHandler(
  echoClient: Echo,
  operation: Operation,
  observer: Observer<FetchResult>,
  setChannelName: (name: string) => any
) {
  return (data: FetchResult) => {
    const operationDefinition: OperationDefinitionNode = operation.query.definitions.find(definitionNode => definitionNode.kind === "OperationDefinition") as OperationDefinitionNode
    const fieldNode: FieldNode = operationDefinition.selectionSet.selections.find(definitionNode => definitionNode.kind === "Field") as FieldNode
    const subscriptionName: string | null = fieldNode.name.value;
    const lighthouseVersion = data?.extensions?.lighthouse_subscriptions?.version; 
      
    const channelName: string | null = lighthouseVersion == 2 ?
        data?.extensions?.lighthouse_subscriptions?.channel :
        data?.extensions?.lighthouse_subscriptions?.channels?.[subscriptionName];

    if (channelName) {
      setChannelName(channelName);
      subscribeToEcho(echoClient, channelName, observer);
    } else {
      observer.next(data);
      observer.complete();
    }
  };
}

function createRequestHandler(echoClient: Echo): RequestHandler {
  return (operation: Operation, forward: NextLink): Observable<FetchResult> => {
    let channelName: string;

    return new Observable((observer) => {
      forward(operation).subscribe(
        createSubscriptionHandler(echoClient, operation, observer, (name) => channelName = name)
      );

      return () => unsubscribe(echoClient, () => channelName);
    });
  };
}

export function createLighthouseSubscriptionLink(echoClient: Echo): ApolloLink {
  return new ApolloLink(createRequestHandler(echoClient));
}
