/** Android chiede di disegnare il widget: aggiunto, aggiornato o ridimensionato. */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { widgetData } from './data';
import { OggiWidget } from './OggiWidget';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  const data = await widgetData(Date.now());
  props.renderWidget(<OggiWidget {...data} />);
}
