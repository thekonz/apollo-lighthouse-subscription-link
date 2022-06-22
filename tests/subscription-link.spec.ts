import { createLighthouseSubscriptionLink } from "../src/subscription-link";
import gql from "graphql-tag";
import Echo from "laravel-echo";
import { Observer, ApolloLink, Observable, execute, FetchResult } from "@apollo/client/core";

jest.mock("laravel-echo");

function echoMock(methods: Object = {}): Echo {
  return methods as Echo;
}

function make(echo: Echo) {
  return createLighthouseSubscriptionLink(echo);
}

const subscription = gql`
  subscription {
    someEvent {
      someProperty
    }
  }
`;

const query = gql`
  query {
    someThing {
      someProperty
    }
  }
`;

function createFakeHttpLink(middleware: Function) {
  return new ApolloLink((operation, forward) => {
    return new Observable((observer) => {
      middleware(observer);
    });
  });
}

describe("subscription link", () => {
  it("creates an apollo link", () => {
    expect(make(echoMock())).toBeInstanceOf(ApolloLink);
  });

  it("subscribes to echo channels and listens to echo events", () => {
    // set up mocks
    const echo = {
      private: jest.fn().mockReturnThis(),
      listen: jest.fn().mockReturnThis(),
    };
    let observer: Observer<FetchResult>;
    const subscriptionHandler = jest.fn();
    const link = ApolloLink.from([
      make(echoMock(echo)),
      createFakeHttpLink(
        (currentObserver: Observer<FetchResult>) => (observer = currentObserver)
      ),
    ]);

    // execute the subscription, no listener should have been called yet
    execute(link, { query: subscription }).subscribe(subscriptionHandler);
    expect(echo.private).not.toHaveBeenCalled();
    expect(echo.listen).not.toHaveBeenCalled();
    expect(subscriptionHandler).not.toHaveBeenCalled();

    // the graphql response from the http link will look like this
    observer.next({
      data: {
        someEvent: null,
      },
      extensions: {
        lighthouse_subscriptions: {
          channels: { someEvent: "private-lighthouse-1234" },
        },
      },
    });
    // echo presence channel should now be joined and listened to
    expect(echo.private).toHaveBeenCalledWith("lighthouse-1234");
    expect(echo.listen).toHaveBeenCalledWith(
      ".lighthouse-subscription",
      expect.any(Function)
    );

    // now we fire some events and the subscriber gets triggered with events
    const listener: Function = echo.listen.mock.calls[0][1];
    expect(subscriptionHandler).not.toHaveBeenCalled();
    const events = [
      { data: { someEvent: { someProperty: "no" } }, extensions: {} },
      { data: { someEvent: { someProperty: "yes" } }, extensions: {} },
    ];
    listener(events[0]);
    expect(subscriptionHandler).toHaveBeenCalledWith(events[0].data);
    listener(events[1]);
    expect(subscriptionHandler).toHaveBeenCalledWith(events[1].data);
  });

  it("works with version 2.", () => {
    // set up mocks
    const echo = {
      private: jest.fn().mockReturnThis(),
      listen: jest.fn().mockReturnThis(),
    };

    let observer: Observer<FetchResult>;
    const subscriptionHandler = jest.fn();
    const link = ApolloLink.from([
      make(echoMock(echo)),
      createFakeHttpLink(
        (currentObserver: Observer<FetchResult>) => (observer = currentObserver)
      ),
    ]);

    // execute the subscription, no listener should have been called yet
    execute(link, { query: subscription }).subscribe(subscriptionHandler);
    expect(echo.private).not.toHaveBeenCalled();
    expect(echo.listen).not.toHaveBeenCalled();
    expect(subscriptionHandler).not.toHaveBeenCalled();

    // the graphql response from the http link will look like this
    observer.next({
      data: {
        someEvent: null,
      },
      extensions: {
        lighthouse_subscriptions: {
          version: 2,
          channel: "private-lighthouse-1234",
        }
      },
    });
    // echo presence channel should now be joined and listened to
    expect(echo.private).toHaveBeenCalledWith("lighthouse-1234");
    expect(echo.listen).toHaveBeenCalledWith(
      ".lighthouse-subscription",
      expect.any(Function)
    );

    // now we fire some events and the subscriber gets triggered with events
    // now we fire some events and the subscriber gets triggered with events
    const listener: Function = echo.listen.mock.calls[0][1];
    expect(subscriptionHandler).not.toHaveBeenCalled();
    const events = [
      { data: { someEvent: { someProperty: "no" } }, extensions: {} },
      { data: { someEvent: { someProperty: "yes" } }, extensions: {} },
    ];
    listener(events[0]);
    expect(subscriptionHandler).toHaveBeenCalledWith(events[0].data);
    listener(events[1]);
    expect(subscriptionHandler).toHaveBeenCalledWith(events[1].data);
  });
    
  it("forwards any query without subscription data", () => {
    // same as before
    const echo = {
      private: jest.fn().mockReturnThis(),
      listen: jest.fn().mockReturnThis(),
    };
    let observer: Observer<FetchResult>;
    const listener = jest.fn();
    const link = ApolloLink.from([
      make(echoMock(echo)),
      createFakeHttpLink(
        (currentObserver: Observer<FetchResult>) => (observer = currentObserver)
      ),
    ]);

    // but with a query
    execute(link, { query }).subscribe(listener);
    expect(echo.private).not.toHaveBeenCalled();
    expect(echo.listen).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();

    // and now the ovserver gets normal query results without the subscription extensions
    const result = {
      data: {
        someThing: { someProperty: "hello" },
      },
    };
    observer.next(result);
    expect(echo.private).not.toHaveBeenCalled();
    expect(echo.listen).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith(result);
  });

  it('can be unsubscribed', () => {
    const echo = {
      private: jest.fn().mockReturnThis(),
      listen: jest.fn().mockReturnThis(),
      leave: jest.fn().mockReturnThis(),
    };
    let observer: Observer<FetchResult>;
    const link = ApolloLink.from([
      make(echoMock(echo)),
      createFakeHttpLink(
        (currentObserver: Observer<FetchResult>) => (observer = currentObserver)
      ),
    ]);

    const subscriber = execute(link, { query: subscription }).subscribe(() => { });
    observer.next({
      data: {
        someEvent: null,
      },
      extensions: {
        lighthouse_subscriptions: {
          channels: { someEvent: "private-lighthouse-2345" },
        },
      },
    });
    expect(echo.leave).not.toHaveBeenCalled();
    subscriber.unsubscribe();
    expect(echo.leave).toHaveBeenCalledWith("private-lighthouse-2345");
  })
});
