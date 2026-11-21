# Interactive prototypes

Select a frame and go to **Prototype**. Choose **Use Single HTML** to get the visual compiler's document and layer metadata. The exported prototype runs in a browser without the plugin.

## Pricing screen walkthrough

1. In **Actions**, choose the plans' common parent and add the annual and monthly card layers as options. Enter distinct option values, then choose the default. Navigate with arrow keys or click a card.
2. Select the Continue layer and add **Continue to demo summary**. It displays the current choice and dispatches a `figma-prototype:continue` event. A real integration can listen for the event and read `event.detail.selectedPlan` and `event.detail.actionId`. The demo makes no checkout request.
3. To reuse the card, open **Components** and select a card as the template and its sibling as the matching instance. Use **Suggest fields and records**, review the bindings, and edit the JSON. The exporter uses one HTML template with text bindings. The first records retain the corresponding authored card identities so the configured choices still work.
4. In **Review**, select a scenario such as **Long translations**, **150% text**, **Zero records**, or **Ten records**. Change the preview width to verify text wrapping and detect clipped text or layers extending horizontally past the viewport.
5. Select each designed state frame and use **Capture current frame** with a state name. The downloaded demo includes a picker for those visual states.
6. Save the integration baseline before remapping or editing a design. Review removed fields, newly required fields, removed action targets, and state changes. Download **Integration JSON** to save the baseline and data schema. Import it in a later session to compare again.
7. Choose **Download demo** for a single interactive HTML file. It uses the original content by default, even if a stress scenario is active in the preview.

## Scope

- Layer mappings and captured frames stay in the current plugin session. The integration contract is portable JSON. Future authoring portability should let teammates import and edit a full prototype configuration.
- Template fields bind scalar text. Suggested values come from layer names and matching text order in the sibling. A boolean `selectedState` can style a repeated card. Image and nested-object bindings, independent per-variant prop configurations, and framework-native component export can be added later.
- Captured states are visual snapshots of selected Figma frames. The interaction layer runs on the active prototype, separately from the state gallery.
- Integration comparison covers persisted IDs and configured fields, events, options, and state names. Recreated Figma layers can require reassignment. Checkout, API calls, and routing remain application integration points.
- The standalone runtime and compiler are covered by automated tests. Layout measurements, typography, and plugin-host behavior should also be validated in Figma Desktop.

## UI references

The workspace takes cues from compact inspector tools and gives export, prototyping, and assets distinct views. Controls appear in the view where they apply.

- [central Figma plugin](https://dribbble.com/shots/23580289-central-Figma-plugin)
- [Color contrast Figma plugin](https://dribbble.com/shots/15101022-Color-contrast-Figma-plugin)
- [Design Tool Interface — Editor & Inspector UI](https://dribbble.com/shots/27623730-Design-Tool-Interface-Editor-Inspector-UI)
