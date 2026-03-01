import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Team name is required"),
});

type Values = z.infer<typeof schema>;

export default function CreateTeamDialog() {
  const { actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
    mode: "onTouched",
  });

  const submit = form.handleSubmit(async (values) => {
    const created = await actions.addTeam({ name: values.name });
    if (!created) return;
    toast({ title: "Team created" });
    setOpen(false);
    form.reset({ name: "" });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Create team
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>Teams let you assign a group of technicians to a site.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Electrical A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
                Create team
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

