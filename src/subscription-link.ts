import { ApolloLink, Observable } from "apollo-link";

import type {
  Operation,
  NextLink,
  FetchResult,
  RequestHandler,
} from "apollo-link";

import type Echo from "laravel-echo";
import { Observer } from "apollo-client/util/Observable";

import type { PresenceChannel, Channel } from "laravel-echo/dist/channel";

// The presence channel interface does not have the channel methods,
// but in reality the actual object does, so I try to fix this here.
type FixedEchoChannel = PresenceChannel & Channel;

function subscribeToEcho(
  echoClient: Echo,
  channelName: string,
  observer: Observer<FetchResult>
) {
  const channel = echoClient.join(channelName) as FixedEchoChannel;

  channel.listen(".lighthouse.subscription", (result: { data: any }) =>
    observer.next({ data: result.data })
  );
}

function createSubscriptionHandler(
  echoClient: Echo,
  operation: Operation,
  observer: Observer<FetchResult>
) {
  return (data: FetchResult) => {
    const channelName: string | null =
      data?.extensions?.lighthouse_subscriptions?.channels?.[
        operation.operationName
      ];

    if (channelName) {
      subscribeToEcho(echoClient, channelName, observer);
    } else {
      observer.next(data);
      observer.complete();
    }
  };
}

function createRequestHandler(echoClient: Echo): RequestHandler {
  return (operation: Operation, forward: NextLink): Observable<FetchResult> => {
    return new Observable((observer) => {
      forward(operation).subscribe(
        createSubscriptionHandler(echoClient, operation, observer)
      );
    });
  };
}

export function createLighthouseSubscriptionLink(echoClient: Echo): ApolloLink {
  return new ApolloLink(createRequestHandler(echoClient));
}
