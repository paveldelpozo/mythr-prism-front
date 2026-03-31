interface BuildSlaveWindowUrlOptions {
  monitorId: string;
  instanceToken: string;
}

export const SLAVE_WINDOW_PATH = '/slave.html';

export const buildSlaveWindowUrl = ({
  monitorId,
  instanceToken
}: BuildSlaveWindowUrlOptions): string => {
  const params = new URLSearchParams({
    monitorId,
    instanceToken
  });

  return `${SLAVE_WINDOW_PATH}?${params.toString()}`;
};
