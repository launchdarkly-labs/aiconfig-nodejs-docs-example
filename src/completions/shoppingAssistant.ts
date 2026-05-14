import { LDContext } from "@launchdarkly/node-server-sdk";
import { getAIMetricsFromResponse } from "@launchdarkly/server-sdk-ai-openai";
import { getLaunchDarklyClients } from "../config/launchdarkly";
import { getOpenAI } from "../config/openAI";
import { formatProductForCompletion, getProducts } from "../data/products";

export const completeShoppingAssistant = async (userName: string, userMessage: string, userPreferences: string[]) => {
  const openaiClient = getOpenAI();

  const { productsAvailable } = await getProducts();

  const { aiClient } = await getLaunchDarklyClients();
  // Create the user context for this request
  const ctx: LDContext = {
    // The context key should be unique to this end user
    // You can use any generated value
    key: "example-user-key",
    kind: "user",
    name: userName,
  };

  // Retrieve the AI Configuration for this context
  const aiConfig = await aiClient.completionConfig(
    // Our AI Config key, which can be copied from the sidebar in the LaunchDarkly UI
    "chat-helper-v1",
    // The context for this request
    ctx,
    // A fallback configuration; if the AI Config is disabled in LaunchDarkly we'll skip execution
    { enabled: false },
    // The parameters for this AI Config; these will replace our {{}} placeholders in the LaunchDarkly UI
    {
        preferences: userPreferences,
        // Fetch our mock product data and format it for the completion matching the format we provided to the model
        productsAvailable: productsAvailable.map(product => formatProductForCompletion(product)),
    }
  );
  // If the AI Config is disabled, make sure to handle that appropriately.
  // For example, you could show a message that the shopping assistant
  // is not available and customers should try again later.
  if (!aiConfig.enabled) {
    console.log("AI Config is disabled");
    return `<pre>The shopping assistant is currently unavailable. Please try again later.</pre>`;
  }

  // Create a tracker for this AI Config invocation
  const tracker = aiConfig.createTracker();

  // Track the completion using the OpenAI provider helper and return the result
  const completion = await tracker.trackMetricsOf(
    getAIMetricsFromResponse,
    () => openaiClient.chat.completions.create({
      model: aiConfig.model!.name as string,
      messages: [
        // Add the system and assistant messages from the AI Config, as well as the user message
        ...aiConfig.messages!,
        { role: "user", content: userMessage }
      ],
    }),
  );

  return `<pre>${completion.choices[0].message.content}</pre>`;
};
